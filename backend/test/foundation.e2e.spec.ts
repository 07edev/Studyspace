import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, AdminStatus, Role } from '../src/common/enums';
import { resetSideEffects, startEnv, type TestEnv } from './helpers';

let env: TestEnv;
const http = () => request(env.app.getHttpServer());
const auth = (userId: string) => ({ Authorization: `Bearer ${env.token(userId)}` });

beforeAll(async () => {
  env = await startEnv();
});
afterAll(async () => {
  await env.close();
});

describe('response contract', () => {
  it('wraps success in { success, data, requestId } under /api/v1', async () => {
    const res = await http().get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok', database: 'up' },
    });
    expect(typeof res.body.requestId).toBe('string');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('does not trust a client supplied request id', async () => {
    const res = await http().get('/api/v1/health').set('X-Request-Id', 'evil').expect(200);
    expect(res.body.requestId).not.toBe('evil');
  });

  it('returns the failure envelope for unknown routes', async () => {
    const res = await http().get('/api/v1/nope').expect(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(res.body.requestId).toBeTruthy();
  });

  it('maps validation errors to 422 with details[field,rule,message]', async () => {
    const id = await env.createUser();
    const res = await http()
      .post('/api/v1/probe/echo')
      .set(auth(id))
      .send({ name: 'x', extra: 1 })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'extra']));
    expect(res.body.error.details[0]).toEqual(
      expect.objectContaining({ field: expect.any(String), rule: expect.any(String), message: expect.any(String) }),
    );
  });
});

describe('authentication', () => {
  it('rejects missing, malformed and wrong-secret tokens with 401', async () => {
    await http().get('/api/v1/probe/me').expect(401);
    await http().get('/api/v1/probe/me').set('Authorization', 'Bearer nope').expect(401);
    const id = await env.createUser();
    const forged = new JwtService({ secret: 'another-secret-another-secret-123456' }).sign({
      sub: id,
      typ: 'access',
    });
    const res = await http()
      .get('/api/v1/probe/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token that is not an access token', async () => {
    const id = await env.createUser();
    const wrong = new JwtService({ secret: env.config.jwtAccessSecret }).sign({
      sub: id,
      typ: 'refresh',
    });
    await http().get('/api/v1/probe/me').set('Authorization', `Bearer ${wrong}`).expect(401);
  });

  it('attaches identity from the database, not from the token', async () => {
    const id = await env.createUser();
    const res = await http().get('/api/v1/probe/me').set(auth(id)).expect(200);
    expect(res.body.data).toMatchObject({ userId: id, role: 'USER', status: 'ACTIVE' });
  });

  it('blocks suspended accounts with ACCOUNT_SUSPENDED even with a live token', async () => {
    const id = await env.createUser({ status: AccountStatus.SUSPENDED });
    const res = await http().get('/api/v1/probe/me').set(auth(id)).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('rejects tokens of users that are not verified/active', async () => {
    const id = await env.createUser({ status: AccountStatus.PENDING_VERIFICATION });
    await http().get('/api/v1/probe/me').set(auth(id)).expect(401);
  });

  it('optional auth: anonymous ok, valid token identified, bad token still 401', async () => {
    const id = await env.createUser();
    const anon = await http().get('/api/v1/probe/optional').expect(200);
    expect(anon.body.data.authenticated).toBe(false);
    const authed = await http().get('/api/v1/probe/optional').set(auth(id)).expect(200);
    expect(authed.body.data.authenticated).toBe(true);
    await http().get('/api/v1/probe/optional').set('Authorization', 'Bearer bad').expect(401);
  });
});

describe('authorization', () => {
  it('USER cannot use admin permissions or super-admin routes', async () => {
    const id = await env.createUser();
    await http().get('/api/v1/probe/users-read').set(auth(id)).expect(403);
    await http().get('/api/v1/probe/super').set(auth(id)).expect(403);
  });

  it('ADMIN needs the exact module+action permission', async () => {
    const none = await env.createUser({ role: Role.ADMIN, permissions: [] });
    const wrongAction = await env.createUser({
      role: Role.ADMIN,
      permissions: [{ module: 'USERS', actions: ['UPDATE'] }],
    });
    const ok = await env.createUser({
      role: Role.ADMIN,
      permissions: [{ module: 'USERS', actions: ['READ'] }],
    });
    await http().get('/api/v1/probe/users-read').set(auth(none)).expect(403);
    await http().get('/api/v1/probe/users-read').set(auth(wrongAction)).expect(403);
    await http().get('/api/v1/probe/users-read').set(auth(ok)).expect(200);
    await http().get('/api/v1/probe/super').set(auth(ok)).expect(403);
  });

  it('SUPER_ADMIN passes permission and super-admin checks', async () => {
    const id = await env.createUser({ role: Role.SUPER_ADMIN });
    await http().get('/api/v1/probe/users-read').set(auth(id)).expect(200);
    await http().get('/api/v1/probe/super').set(auth(id)).expect(200);
  });

  it('disabled or missing admin profile removes admin access immediately', async () => {
    const disabled = await env.createUser({ role: Role.ADMIN, adminStatus: AdminStatus.DISABLED });
    const missing = await env.createUser({ role: Role.ADMIN, noProfile: true });
    await http().get('/api/v1/probe/me').set(auth(disabled)).expect(403);
    await http().get('/api/v1/probe/me').set(auth(missing)).expect(403);
  });
});

describe('idempotency', () => {
  beforeEach(() => resetSideEffects());

  it('requires the Idempotency-Key header', async () => {
    const id = await env.createUser();
    const res = await http()
      .post('/api/v1/probe/once')
      .set(auth(id))
      .send({ name: 'abc' })
      .expect(422);
    expect(res.body.error.details[0].field).toBe('Idempotency-Key');
  });

  it('runs once and replays the stored result for the same key and body', async () => {
    const id = await env.createUser();
    const send = () =>
      http()
        .post('/api/v1/probe/once')
        .set(auth(id))
        .set('Idempotency-Key', 'key-replay-0001')
        .send({ name: 'abc' });
    const first = await send().expect(201);
    const second = await send().expect(201);
    expect(first.body.data).toEqual({ name: 'abc', n: 1 });
    expect(second.body.data).toEqual({ name: 'abc', n: 1 });
  });

  it('rejects the same key with a different body', async () => {
    const id = await env.createUser();
    const key = 'key-conflict-001';
    await http().post('/api/v1/probe/once').set(auth(id)).set('Idempotency-Key', key).send({ name: 'abc' }).expect(201);
    const res = await http()
      .post('/api/v1/probe/once')
      .set(auth(id))
      .set('Idempotency-Key', key)
      .send({ name: 'different' })
      .expect(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('does not cache failures, so the same key can be retried', async () => {
    const id = await env.createUser();
    const key = 'key-retry-00001';
    await http().post('/api/v1/probe/once').set(auth(id)).set('Idempotency-Key', key).send({ name: 'x' }).expect(422);
    const ok = await http()
      .post('/api/v1/probe/once')
      .set(auth(id))
      .set('Idempotency-Key', key)
      .send({ name: 'valid' })
      .expect(201);
    expect(ok.body.data.name).toBe('valid');
  });

  it('scopes keys per actor', async () => {
    const a = await env.createUser();
    const b = await env.createUser();
    const key = 'key-shared-0001';
    const ra = await http().post('/api/v1/probe/once').set(auth(a)).set('Idempotency-Key', key).send({ name: 'abc' }).expect(201);
    const rb = await http().post('/api/v1/probe/once').set(auth(b)).set('Idempotency-Key', key).send({ name: 'abc' }).expect(201);
    expect(ra.body.data.n).toBe(1);
    expect(rb.body.data.n).toBe(2);
  });
});
