import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Model } from 'mongoose';
import { ApiException } from '../src/common/api-error';
import { AccountStatus, Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { OtpChallenge } from '../src/modules/identity/schemas/otp-challenge.schema';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
const PASS = 'Str0ngPassw0rd';
const NEW_PASS = 'An0therStrongPass';
const http = () => request(env.app.getHttpServer());
const post = (path: string, body: object = {}, token?: string) => {
  const r = http().post(`/api/v1${path}`).send(body);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};
const get = (path: string, token?: string) => {
  const r = http().get(`/api/v1${path}`);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};
let n = 0;
const email = () => `auth${(n += 1)}@example.test`;

const GOOGLE: Record<string, { email: string; emailVerified: boolean; name?: string }> = {};
beforeAll(async () => {
  env = await startEnv({
    google: async token => {
      const profile = GOOGLE[token];
      if (!profile) {
        throw new ApiException(401, 'GOOGLE_TOKEN_INVALID', 'invalid');
      }
      return profile;
    },
  });
});
afterAll(async () => {
  await env.close();
});

async function signup(address = email(), password = PASS, extra: object = {}) {
  await post('/auth/register', {
    displayName: 'Test User',
    email: address,
    password,
    confirmPassword: password,
    ...extra,
  }).expect(201);
  const res = await post('/auth/email/verify', {
    email: address,
    otp: env.otp(address, 'EMAIL_VERIFY'),
  }).expect(200);
  return {
    address,
    accessToken: res.body.data.tokens.accessToken as string,
    refreshToken: res.body.data.tokens.refreshToken as string,
    userId: res.body.data.user.id as string,
  };
}
const mobileLogin = (address: string, password = PASS) =>
  post('/auth/login', { email: address, password, client: 'MOBILE' });

describe('register + email verification', () => {
  it('rejects weak, mismatched and malformed input with field errors', async () => {
    const res = await post('/auth/register', {
      displayName: 'A',
      email: 'not-an-email',
      password: 'short',
      confirmPassword: 'other',
    }).expect(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['displayName', 'email', 'password', 'confirmPassword']));
    const weak = await post('/auth/register', {
      displayName: 'Valid Name',
      email: email(),
      password: 'alllowercase1',
      confirmPassword: 'alllowercase1',
    }).expect(422);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a pending account, blocks login until verified, then issues a session', async () => {
    const address = email();
    const reg = await post('/auth/register', {
      displayName: 'New User',
      email: address.toUpperCase(),
      password: PASS,
      confirmPassword: PASS,
    }).expect(201);
    expect(reg.body.data).toMatchObject({ email: address, status: 'PENDING_VERIFICATION' });
    const blocked = await mobileLogin(address).expect(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const wrong = await post('/auth/email/verify', { email: address, otp: '000000' });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.code).toBe('OTP_INVALID');

    const ok = await post('/auth/email/verify', {
      email: address,
      otp: env.otp(address, 'EMAIL_VERIFY'),
    }).expect(200);
    expect(ok.body.data.user).toMatchObject({ email: address, status: 'ACTIVE', emailVerified: true });
    expect(ok.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash|otpHash/);
    expect(ok.body.data.tokens.refreshToken).toBeTruthy();
    const me = await get('/auth/me', ok.body.data.tokens.accessToken).expect(200);
    expect(me.body.data.email).toBe(address);
  });

  it('locks the code after too many wrong attempts, even if the right one follows', async () => {
    const address = email();
    await post('/auth/register', {
      displayName: 'Locked User',
      email: address,
      password: PASS,
      confirmPassword: PASS,
    }).expect(201);
    const code = env.otp(address, 'EMAIL_VERIFY')!;
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < env.config.otpMaxAttempts; i += 1) {
      await post('/auth/email/verify', { email: address, otp: wrong }).expect(422);
    }
    const res = await post('/auth/email/verify', { email: address, otp: code }).expect(429);
    expect(res.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('rejects an expired code and accepts a freshly requested one', async () => {
    const address = email();
    await post('/auth/register', {
      displayName: 'Slow User',
      email: address,
      password: PASS,
      confirmPassword: PASS,
    }).expect(201);
    const old = env.otp(address, 'EMAIL_VERIFY')!;
    const challenges = env.app.get<Model<OtpChallenge>>(getModelToken(OtpChallenge.name));
    await challenges.updateMany({ emailNormalized: address }, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await post('/auth/email/verify', { email: address, otp: old }).expect(410);
    expect(expired.body.error.code).toBe('OTP_EXPIRED');
    await post('/auth/email/resend-otp', { email: address }).expect(202);
    await post('/auth/email/verify', { email: address, otp: env.otp(address, 'EMAIL_VERIFY') }).expect(200);
  });

  it('rejects duplicate email and phone once the account is active', async () => {
    const taken = email();
    await signup(taken, PASS, { phone: '+84901234567' });
    const dupEmail = await post('/auth/register', {
      displayName: 'Dup',
      email: taken,
      password: PASS,
      confirmPassword: PASS,
    }).expect(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    const dupPhone = await post('/auth/register', {
      displayName: 'Dup',
      email: email(),
      phone: '+84 901 234 567',
      password: PASS,
      confirmPassword: PASS,
    }).expect(409);
    expect(dupPhone.body.error.code).toBe('PHONE_ALREADY_EXISTS');
  });

  it('lets an unverified signup be retried (no squatting)', async () => {
    const address = email();
    const body = { displayName: 'Retry', email: address, password: PASS, confirmPassword: PASS };
    await post('/auth/register', body).expect(201);
    await post('/auth/register', { ...body, password: NEW_PASS, confirmPassword: NEW_PASS }).expect(201);
    await post('/auth/email/verify', { email: address, otp: env.otp(address, 'EMAIL_VERIFY') }).expect(200);
    await mobileLogin(address, NEW_PASS).expect(200);
    await mobileLogin(address, PASS).expect(401);
  });

  it('resend answers the same for unknown emails', async () => {
    const res = await post('/auth/email/resend-otp', { email: 'nobody@example.test' }).expect(202);
    expect(res.body.data.message).toBeTruthy();
    expect(env.otp('nobody@example.test', 'EMAIL_VERIFY')).toBeUndefined();
  });
});

describe('login', () => {
  it('gives the same error for wrong password and unknown email', async () => {
    const { address } = await signup();
    const wrong = await mobileLogin(address, 'Wr0ngPasswordHere').expect(401);
    const unknown = await mobileLogin('ghost@example.test').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error).toEqual(wrong.body.error);
  });

  it('blocks suspended accounts', async () => {
    const { address, userId } = await signup();
    await env.users.updateOne({ _id: userId }, { status: AccountStatus.SUSPENDED });
    const res = await mobileLogin(address).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('web admin login needs an active admin profile and keeps the refresh token in a cookie', async () => {
    const user = await signup();
    const denied = await post('/auth/login', { email: user.address, password: PASS, client: 'WEB_ADMIN' }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    await env.createUser({ email: 'admin@example.test', role: Role.ADMIN, password: PASS });
    const res = await post('/auth/login', { email: 'admin@example.test', password: PASS, client: 'WEB_ADMIN' }).expect(200);
    expect(res.body.data.tokens.refreshToken).toBeUndefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/ss_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejects malformed payloads without touching the database', async () => {
    const res = await post('/auth/login', { email: 'x', password: '', client: 'TV' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('refresh tokens', () => {
  it('rotates on every refresh', async () => {
    const { refreshToken } = await signup();
    const res = await post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }).expect(200);
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
    await get('/auth/me', res.body.data.accessToken).expect(200);
  });

  it('revokes the whole family when an old refresh token is replayed', async () => {
    const { refreshToken } = await signup();
    const first = await post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }).expect(200);
    const replay = await post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }).expect(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');
    // The legitimate newest token and its access token die too.
    await post('/auth/token/refresh', { refreshToken: first.body.data.refreshToken, client: 'MOBILE' }).expect(401);
    await get('/auth/me', first.body.data.accessToken).expect(401);
  });

  it('lets only one of two parallel refreshes win', async () => {
    const { refreshToken } = await signup();
    const calls = await Promise.all([
      post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }),
      post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }),
    ]);
    expect(calls.map(c => c.status).sort()).toEqual([200, 401]);
  });

  it('reports invalid, wrong-client and expired tokens', async () => {
    const { refreshToken } = await signup();
    const invalid = await post('/auth/token/refresh', { refreshToken: 'x'.repeat(40), client: 'MOBILE' }).expect(401);
    expect(invalid.body.error.code).toBe('TOKEN_INVALID');
    await post('/auth/token/refresh', { refreshToken, client: 'WEB_ADMIN' })
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(401);
    const second = await signup();
    await env.sessions.updateMany({ userId: second.userId }, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await post('/auth/token/refresh', { refreshToken: second.refreshToken, client: 'MOBILE' }).expect(401);
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('refuses refresh for a suspended account', async () => {
    const { refreshToken, userId } = await signup();
    await env.users.updateOne({ _id: userId }, { status: AccountStatus.SUSPENDED });
    const res = await post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('web refresh needs the CSRF header and rotates the cookie', async () => {
    await env.createUser({ email: 'webadmin@example.test', role: Role.ADMIN, password: PASS });
    const login = await post('/auth/login', { email: 'webadmin@example.test', password: PASS, client: 'WEB_ADMIN' }).expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await post('/auth/token/refresh', { client: 'WEB_ADMIN' }).set('Cookie', cookie).expect(403);
    const ok = await post('/auth/token/refresh', { client: 'WEB_ADMIN' })
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .expect(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(ok.body.data.refreshToken).toBeUndefined();
    expect((ok.headers['set-cookie'] as unknown as string[])[0].split(';')[0]).not.toBe(cookie);
  });
});

describe('logout', () => {
  it('ends the session for both access and refresh tokens', async () => {
    const { accessToken, refreshToken } = await signup();
    await post('/auth/logout', {}, accessToken).expect(204);
    await get('/auth/me', accessToken).expect(401);
    await post('/auth/token/refresh', { refreshToken, client: 'MOBILE' }).expect(401);
  });

  it('requires authentication', async () => {
    await post('/auth/logout').expect(401);
  });
});

describe('forgot / reset password', () => {
  it('does not reveal whether an email exists', async () => {
    const res = await post('/auth/password/forgot', { email: 'nobody@example.test' }).expect(202);
    expect(res.body.data.message).toBeTruthy();
    expect(env.otp('nobody@example.test', 'PASSWORD_RESET')).toBeUndefined();
    const bad = await post('/auth/password/verify-otp', { email: 'nobody@example.test', otp: '123456' });
    expect(bad.body.error.code).toBe('OTP_INVALID');
  });

  it('resets the password once, revokes all sessions and kills the grant', async () => {
    const { address, accessToken } = await signup();
    await post('/auth/password/forgot', { email: address }).expect(202);
    const grant = await post('/auth/password/verify-otp', {
      email: address,
      otp: env.otp(address, 'PASSWORD_RESET'),
    }).expect(200);
    const resetToken = grant.body.data.resetToken as string;

    const weak = await post('/auth/password/reset', { resetToken, newPassword: 'weak', confirmPassword: 'weak' }).expect(422);
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');
    await post('/auth/password/reset', { resetToken, newPassword: NEW_PASS, confirmPassword: NEW_PASS }).expect(200);

    await mobileLogin(address, NEW_PASS).expect(200);
    await mobileLogin(address, PASS).expect(401);
    await get('/auth/me', accessToken).expect(401);
    const again = await post('/auth/password/reset', { resetToken, newPassword: PASS, confirmPassword: PASS }).expect(401);
    expect(again.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects garbage, access tokens and expired grants as reset tokens', async () => {
    const { userId, accessToken } = await signup();
    const garbage = await post('/auth/password/reset', {
      resetToken: 'g'.repeat(30),
      newPassword: NEW_PASS,
      confirmPassword: NEW_PASS,
    }).expect(401);
    expect(garbage.body.error.code).toBe('RESET_TOKEN_INVALID');
    await post('/auth/password/reset', { resetToken: accessToken, newPassword: NEW_PASS, confirmPassword: NEW_PASS }).expect(401);
    const expiredToken = new JwtService({ secret: env.config.jwtAccessSecret }).sign(
      { sub: userId, typ: 'reset', pwv: 'x' },
      { expiresIn: -10 },
    );
    const expired = await post('/auth/password/reset', { resetToken: expiredToken, newPassword: NEW_PASS, confirmPassword: NEW_PASS }).expect(410);
    expect(expired.body.error.code).toBe('RESET_TOKEN_EXPIRED');
  });

  it('keeps OTP purposes separate (a reset code cannot verify an email)', async () => {
    const { address } = await signup();
    await post('/auth/password/forgot', { email: address }).expect(202);
    const resetCode = env.otp(address, 'PASSWORD_RESET');
    const res = await post('/auth/email/verify', { email: address, otp: resetCode });
    expect(res.body.error.code).toBe('OTP_INVALID');
  });
});

describe('change password', () => {
  it('needs the current password and keeps only the current session', async () => {
    const { address, accessToken } = await signup();
    const other = (await mobileLogin(address).expect(200)).body.data.tokens.accessToken as string;

    const wrong = await post('/auth/password/change', { currentPassword: 'Wr0ngPasswordHere', newPassword: NEW_PASS, confirmPassword: NEW_PASS }, accessToken).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const weak = await post('/auth/password/change', { currentPassword: PASS, newPassword: 'weak', confirmPassword: 'weak' }, accessToken).expect(422);
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');

    await post('/auth/password/change', { currentPassword: PASS, newPassword: NEW_PASS, confirmPassword: NEW_PASS }, accessToken).expect(200);
    await get('/auth/me', accessToken).expect(200);
    await get('/auth/me', other).expect(401);
    await mobileLogin(address, NEW_PASS).expect(200);
  });

  it('is unsupported for Google-only accounts', async () => {
    GOOGLE['g'.repeat(30)] = { email: 'gonly@example.test', emailVerified: true, name: 'G Only' };
    const login = await post('/auth/google', { idToken: 'g'.repeat(30), client: 'MOBILE' }).expect(200);
    const res = await post('/auth/password/change', { currentPassword: PASS, newPassword: NEW_PASS, confirmPassword: NEW_PASS }, login.body.data.tokens.accessToken).expect(409);
    expect(res.body.error.code).toBe('AUTH_PROVIDER_UNSUPPORTED');
  });
});

describe('google login', () => {
  it('creates, then reuses, an account and links to an existing password account', async () => {
    GOOGLE['n'.repeat(30)] = { email: 'newgoogle@example.test', emailVerified: true, name: 'New Google' };
    const first = await post('/auth/google', { idToken: 'n'.repeat(30), client: 'MOBILE' }).expect(200);
    expect(first.body.data.user).toMatchObject({ email: 'newgoogle@example.test', status: 'ACTIVE', authProviders: ['GOOGLE'] });
    const second = await post('/auth/google', { idToken: 'n'.repeat(30), client: 'MOBILE' }).expect(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);

    const existing = await signup();
    GOOGLE['l'.repeat(30)] = { email: existing.address, emailVerified: true };
    const linked = await post('/auth/google', { idToken: 'l'.repeat(30), client: 'MOBILE' }).expect(200);
    expect(linked.body.data.user.id).toBe(existing.userId);
    expect(linked.body.data.user.authProviders).toEqual(expect.arrayContaining(['PASSWORD', 'GOOGLE']));
  });

  it('rejects invalid tokens, unverified Google emails and suspended accounts', async () => {
    const bad = await post('/auth/google', { idToken: 'x'.repeat(30), client: 'MOBILE' }).expect(401);
    expect(bad.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
    GOOGLE['u'.repeat(30)] = { email: 'unverified@example.test', emailVerified: false };
    await post('/auth/google', { idToken: 'u'.repeat(30), client: 'MOBILE' }).expect(401);
    const { address, userId } = await signup();
    GOOGLE['s'.repeat(30)] = { email: address, emailVerified: true };
    await env.users.updateOne({ _id: userId }, { status: AccountStatus.SUSPENDED });
    const res = await post('/auth/google', { idToken: 's'.repeat(30), client: 'MOBILE' }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('does not allow the WEB_ADMIN client', async () => {
    await post('/auth/google', { idToken: 'w'.repeat(30), client: 'WEB_ADMIN' }).expect(422);
  });
});

describe('contact change', () => {
  it('changes the email only after the new address confirms the code', async () => {
    const { address, accessToken, userId } = await signup();
    const target = email();
    const challenge = await post('/auth/contact/change-request', { channel: 'EMAIL', value: target }, accessToken).expect(202);
    expect(challenge.body.data.destination).not.toBe(target);
    expect((await env.users.findById(userId))?.emailNormalized).toBe(address);

    const wrong = await post('/auth/contact/change-confirm', { challengeId: challenge.body.data.challengeId, otp: '000000' }, accessToken).expect(422);
    expect(wrong.body.error.code).toBe('OTP_INVALID');
    const ok = await post('/auth/contact/change-confirm', { challengeId: challenge.body.data.challengeId, otp: env.otp(target, 'CONTACT_CHANGE') }, accessToken).expect(200);
    expect(ok.body.data.email).toBe(target);
    await mobileLogin(target).expect(200);
    await mobileLogin(address).expect(401);
  });

  it('rejects contacts that belong to someone else and challenges of other users', async () => {
    const a = await signup();
    const b = await signup();
    const clash = await post('/auth/contact/change-request', { channel: 'EMAIL', value: b.address }, a.accessToken).expect(409);
    expect(clash.body.error.code).toBe('CONTACT_ALREADY_EXISTS');
    const target = email();
    const challenge = await post('/auth/contact/change-request', { channel: 'EMAIL', value: target }, a.accessToken).expect(202);
    const stolen = await post('/auth/contact/change-confirm', { challengeId: challenge.body.data.challengeId, otp: env.otp(target, 'CONTACT_CHANGE') }, b.accessToken).expect(422);
    expect(stolen.body.error.code).toBe('OTP_INVALID');
    expect((await env.users.findById(b.userId))?.emailNormalized).toBe(b.address);
  });

  it('changes the phone number and validates the format', async () => {
    const { accessToken, userId } = await signup();
    await post('/auth/contact/change-request', { channel: 'PHONE', value: 'not-a-phone-number' }, accessToken).expect(422);
    const challenge = await post('/auth/contact/change-request', { channel: 'PHONE', value: '+84 912 345 678' }, accessToken).expect(202);
    const res = await post('/auth/contact/change-confirm', { challengeId: challenge.body.data.challengeId, otp: env.otp('+84912345678', 'CONTACT_CHANGE') }, accessToken).expect(200);
    expect(res.body.data.phone).toBe('+84912345678');
    expect((await env.users.findById(userId))?.phoneNormalized).toBe('+84912345678');
  });
});

describe('account deletion request', () => {
  it('needs explicit confirmation and re-authentication', async () => {
    const { accessToken } = await signup();
    await post('/auth/account/deletion-requests', { confirm: false, password: PASS }, accessToken).expect(422);
    const none = await post('/auth/account/deletion-requests', { confirm: true }, accessToken).expect(403);
    expect(none.body.error.code).toBe('REAUTH_REQUIRED');
    await post('/auth/account/deletion-requests', { confirm: true, password: 'Wr0ngPasswordHere' }, accessToken).expect(403);
  });

  it('marks the account and writes an audit entry', async () => {
    const { accessToken, userId } = await signup();
    await post('/auth/account/deletion-requests', { confirm: true, password: PASS, reason: 'leaving' }, accessToken).expect(202);
    expect((await env.users.findById(userId))?.status).toBe('DELETION_REQUESTED');
    const logs = env.app.get<Model<AuditLog>>(getModelToken(AuditLog.name));
    const entry = await logs.findOne({ action: 'ACCOUNT_DELETION_REQUESTED', resourceId: userId }).lean();
    expect(entry?.after).toMatchObject({ status: 'DELETION_REQUESTED' });
  });

  it('asks Google-only accounts to sign in again if their login is stale', async () => {
    GOOGLE['d'.repeat(30)] = { email: 'gdelete@example.test', emailVerified: true };
    const login = await post('/auth/google', { idToken: 'd'.repeat(30), client: 'MOBILE' }).expect(200);
    const token = login.body.data.tokens.accessToken as string;
    const id = login.body.data.user.id as string;
    await env.users.updateOne({ _id: id }, { lastLoginAt: new Date(Date.now() - 3_600_000) });
    await post('/auth/account/deletion-requests', { confirm: true }, token).expect(403);
    await env.users.updateOne({ _id: id }, { lastLoginAt: new Date() });
    await post('/auth/account/deletion-requests', { confirm: true }, token).expect(202);
  });
});
