import { createTransport } from 'nodemailer';
import request from 'supertest';
import { ApiException } from '../src/common/api-error';
import { loadConfig, type AppConfig } from '../src/config/configuration';
import { SmtpMailService } from '../src/modules/auth/mail.service';
import { startEnv, type TestEnv } from './helpers';

const baseEnv = {
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
};

describe('SMTP config', () => {
  it('is mandatory in production and needs a sender', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
    expect(() => loadConfig({ ...baseEnv, SMTP_HOST: 'smtp.example.com' })).toThrow(/MAIL_FROM/);
  });

  it('parses SMTP settings, inferring TLS mode from the port', () => {
    const implicit = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'me@gmail.com',
      SMTP_PASS: 'app-password',
      MAIL_FROM: 'StudySpace <me@gmail.com>',
    });
    expect(implicit.smtp).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
    const starttls = loadConfig({
      ...baseEnv,
      SMTP_HOST: 'smtp-relay.brevo.com',
      MAIL_FROM: 'a@b.c',
    });
    expect(starttls.smtp).toMatchObject({ port: 587, secure: false });
    expect(loadConfig(baseEnv).smtp).toBeUndefined();
  });
});

describe('SmtpMailService', () => {
  const config = {
    otpTtlSeconds: 300,
    smtp: { host: 'h', port: 587, secure: false, from: 'StudySpace <no-reply@example.com>' },
  } as AppConfig;

  it('sends a Vietnamese email containing the code, the expiry and a safety warning', async () => {
    const transport = createTransport({ jsonTransport: true });
    const send = vi.spyOn(transport, 'sendMail');
    await new SmtpMailService(config, transport).sendOtp(
      { email: 'user@example.test' },
      'PASSWORD_RESET',
      '123456',
    );
    const mail = send.mock.calls[0][0] as Record<string, string>;
    expect(mail.to).toBe('user@example.test');
    expect(mail.from).toBe('StudySpace <no-reply@example.com>');
    expect(mail.subject).toBe('Mã đặt lại mật khẩu StudySpace');
    expect(mail.text).toContain('123456');
    expect(mail.text).toContain('5 phút');
    expect(mail.text).toMatch(/Không chia sẻ/);
    expect(mail.html).toContain('123456');
  });

  it('turns delivery failures into a clean 503 that does not leak the code', async () => {
    const transport = createTransport({ jsonTransport: true });
    vi.spyOn(transport, 'sendMail').mockRejectedValue(new Error('connect ECONNREFUSED'));
    const error = await new SmtpMailService(config, transport)
      .sendOtp({ email: 'user@example.test' }, 'EMAIL_VERIFY', '654321')
      .catch(e => e);
    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe('MAIL_DELIVERY_FAILED');
    expect(error.getStatus()).toBe(503);
    expect(error.message).not.toContain('654321');
  });

  it('refuses SMS instead of pretending to send', async () => {
    const service = new SmtpMailService(config, createTransport({ jsonTransport: true }));
    expect(service.canSendSms()).toBe(false);
    const error = await service.sendOtp({ phone: '+84901234567' }, 'CONTACT_CHANGE', '111111').catch(e => e);
    expect(error.code).toBe('SMS_NOT_CONFIGURED');
  });
});

describe('with a real SMTP service wired in', () => {
  let env: TestEnv;
  const post = (path: string, body: object, token?: string) => {
    const r = request(env.app.getHttpServer()).post(`/api/v1${path}`).send(body);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  beforeAll(async () => {
    // Port 1 refuses connections immediately, so no email can actually leave the machine.
    env = await startEnv({
      config: { smtp: { host: '127.0.0.1', port: 1, secure: false, from: 'StudySpace <no-reply@example.test>' } },
    });
  });
  afterAll(async () => {
    await env.close();
  });

  it('reports MAIL_DELIVERY_FAILED when the mail server is unreachable', async () => {
    const res = await post('/auth/register', {
      displayName: 'Mail Fail',
      email: 'mailfail@example.test',
      password: 'Str0ngPassw0rd',
      confirmPassword: 'Str0ngPassw0rd',
    }).expect(503);
    expect(res.body.error.code).toBe('MAIL_DELIVERY_FAILED');
  });

  it('rejects phone changes up front with SMS_NOT_CONFIGURED', async () => {
    const id = await env.createUser();
    const res = await post(
      '/auth/contact/change-request',
      { channel: 'PHONE', newValue: '+84901234567' },
      env.token(id),
    ).expect(503);
    expect(res.body.error.code).toBe('SMS_NOT_CONFIGURED');
  });
});

describe('Vietnamese error messages', () => {
  let env: TestEnv;
  const http = () => request(env.app.getHttpServer());
  beforeAll(async () => {
    env = await startEnv();
  });
  afterAll(async () => {
    await env.close();
  });

  it('translates validation messages and keeps field/rule', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ displayName: 'A', email: 'bad', phone: 'abc', password: 'x', confirmPassword: 'y', hack: 1 })
      .expect(422);
    const byField = Object.fromEntries(
      res.body.error.details.map((d: { field: string; message: string }) => [d.field, d.message]),
    );
    expect(byField.email).toBe('Email không hợp lệ.');
    expect(byField.displayName).toBe('Cần tối thiểu 2 ký tự.');
    expect(byField.phone).toBe('Số điện thoại không hợp lệ.');
    expect(byField.hack).toBe('Trường này không được hỗ trợ.');
    for (const detail of res.body.error.details) {
      expect(detail.message).not.toMatch(/\b(must|should|be|property)\b/);
    }
  });

  it('uses Vietnamese for framework-level errors too', async () => {
    const notFound = await http().get('/api/v1/does-not-exist').expect(404);
    expect(notFound.body.error.message).toBe('Không tìm thấy nội dung được yêu cầu.');
    const unauth = await http().get('/api/v1/auth/me').expect(401);
    expect(unauth.body.error.message).toMatch(/đăng nhập/);
    const wrongShape = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.test', password: 'p', client: 'TV' })
      .expect(422);
    expect(wrongShape.body.error.details[0].message).toBe('Giá trị không nằm trong danh sách cho phép.');
  });
});
