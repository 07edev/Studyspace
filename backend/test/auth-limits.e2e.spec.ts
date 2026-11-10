import request from 'supertest';
import { startEnv, type TestEnv } from './helpers';

// Separate app instance: rate limiting and OTP cooldown are switched on here.
let env: TestEnv;
const post = (path: string, body: object) =>
  request(env.app.getHttpServer()).post(`/api/v1${path}`).send(body);

beforeAll(async () => {
  env = await startEnv({ config: { disableRateLimit: false, otpCooldownSeconds: 60 } });
});
afterAll(async () => {
  await env.close();
});

describe('abuse protection', () => {
  it('rate limits login attempts and tells the client when to retry', async () => {
    const attempt = () =>
      post('/auth/login', { email: 'a@example.test', password: 'Whatever12345', client: 'MOBILE' });
    let last = await attempt();
    for (let i = 0; i < 12 && last.status !== 429; i += 1) {
      last = await attempt();
    }
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
    expect(last.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(last.headers['retry-after']).toBeTruthy();
  });

  it('enforces a cooldown between OTP requests for the same email', async () => {
    await env.createUser({ email: 'cool@example.test', password: 'Str0ngPassw0rd' });
    await post('/auth/password/forgot', { email: 'cool@example.test' }).expect(202);
    const second = await post('/auth/password/forgot', { email: 'cool@example.test' }).expect(429);
    expect(second.body.error.code).toBe('OTP_COOLDOWN');
    expect(second.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(second.headers['retry-after']).toBeTruthy();
  });
});
