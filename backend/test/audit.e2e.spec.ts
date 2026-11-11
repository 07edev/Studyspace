import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import mongoose, { Model } from 'mongoose';
import { Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { AuditService } from '../src/modules/audit/audit.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let logs: Model<AuditLog>;
const http = () => request(env.app.getHttpServer());
const call = (path: string, userId?: string, method: 'get' | 'post' | 'patch' | 'delete' = 'get') => {
  const r = http()[method](`/api/v1${path}`);
  if (userId) r.set('Authorization', `Bearer ${env.token(userId)}`);
  return r;
};
const oid = () => new mongoose.Types.ObjectId();

let reader: string; // ADMIN with AUDIT.READ
let actorA: string;
const resourceX = oid();
const resourceY = oid();

// Raw inserts so every row has a known time (the schema stamps createdAt itself).
const insert = (rows: object[]) => logs.collection.insertMany(rows as never[]);
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  env = await startEnv();
  logs = env.app.get(getModelToken(AuditLog.name));
  reader = await env.createUser({ role: Role.ADMIN, permissions: [{ module: 'AUDIT', actions: ['READ'] }] });
  actorA = await env.createUser({ email: 'actor.a@example.test' });
  await env.users.updateOne({ _id: actorA }, { 'profile.displayName': 'Actor Alpha' });
  await insert([
    { actorId: new mongoose.Types.ObjectId(actorA), actorType: 'ADMIN', action: 'USER_SUSPENDED', resourceType: 'user', resourceId: resourceX, requestId: 'req-1', before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED', reason: 'spam' }, createdAt: at('2026-03-01T10:00:00Z') },
    { actorId: new mongoose.Types.ObjectId(actorA), actorType: 'ADMIN', action: 'USER_UNSUSPENDED', resourceType: 'user', resourceId: resourceX, requestId: 'req-2', createdAt: at('2026-03-02T10:00:00Z') },
    { actorId: oid(), actorType: 'USER', action: 'PASSWORD_CHANGED', resourceType: 'user', resourceId: resourceY, requestId: 'req-3', createdAt: at('2026-03-03T10:00:00Z') },
    { actorType: 'SYSTEM', action: 'OUTBOX_DISPATCH_FAILED', resourceType: 'outbox', requestId: 'req-4', createdAt: at('2026-03-04T10:00:00Z') },
    { actorId: new mongoose.Types.ObjectId(actorA), actorType: 'ADMIN', action: 'ADMIN_CREATED', resourceType: 'admin', resourceId: oid(), requestId: 'req-5', createdAt: at('2026-03-05T10:00:00Z') },
  ]);
});
afterAll(() => env.close());

describe('access control', () => {
  it('needs AUDIT.READ; other permissions, plain users and guests are refused', async () => {
    await call('/admin/audit-logs').expect(401);
    await call('/admin/audit-logs', actorA).expect(403);
    const other = await env.createUser({ role: Role.ADMIN, permissions: [{ module: 'USERS', actions: ['READ', 'UPDATE'] }] });
    await call('/admin/audit-logs', other).expect(403);
    await call('/admin/audit-logs', reader).expect(200);
    const root = await env.createUser({ role: Role.SUPER_ADMIN });
    await call('/admin/audit-logs', root).expect(200);
  });

  it('is read-only: there is no way to change or delete an entry through the API', async () => {
    const first = (await call('/admin/audit-logs?limit=1', reader)).body.data.items[0];
    for (const method of ['post', 'patch', 'delete'] as const) {
      const res = await call(`/admin/audit-logs/${first.id}`, reader, method);
      expect([404, 405]).toContain(res.status);
    }
    expect(await logs.countDocuments()).toBeGreaterThanOrEqual(5);
  });
});

describe('GET /admin/audit-logs', () => {
  it('returns Page<AuditEvent>, newest first, with the actor named when it is an account', async () => {
    const res = await call('/admin/audit-logs?limit=3', reader).expect(200);
    const { items, pagination } = res.body.data;
    expect(pagination).toMatchObject({ page: 1, limit: 3, hasNext: true });
    expect(pagination.total).toBeGreaterThanOrEqual(5);
    expect(items.map((e: { action: string }) => e.action)).toEqual(['ADMIN_CREATED', 'OUTBOX_DISPATCH_FAILED', 'PASSWORD_CHANGED']);
    expect(items[0].actor).toEqual({ displayName: 'Actor Alpha', email: 'actor.a@example.test' });
    expect(items[1].actor).toBeUndefined(); // SYSTEM: no account behind it
    expect(items[0]).toEqual(expect.objectContaining({ id: expect.any(String), actorType: 'ADMIN', resourceType: 'admin', requestId: 'req-5', createdAt: expect.any(String) }));
  });

  it('filters by action (contains, any case, literal text), actor, type, resource, request id and time', async () => {
    const ids = async (qs: string) => (await call(`/admin/audit-logs?${qs}`, reader).expect(200)).body.data.items.map((e: { requestId: string }) => e.requestId);
    expect(await ids('action=suspended')).toEqual(['req-2', 'req-1']); // matches both SUSPENDED and UNSUSPENDED
    expect(await ids('action=USER_S')).toEqual(['req-1']);
    expect(await ids('action=.*')).toEqual([]); // not a pattern
    expect(await ids(`actorId=${actorA}`)).toEqual(['req-5', 'req-2', 'req-1']);
    expect(await ids('actorType=SYSTEM')).toEqual(['req-4']);
    expect(await ids('resourceType=outbox')).toEqual(['req-4']);
    expect(await ids(`resourceId=${resourceX}`)).toEqual(['req-2', 'req-1']);
    expect(await ids('requestId=req-3')).toEqual(['req-3']);
    expect(await ids('from=2026-03-02T00:00:00Z&to=2026-03-04T00:00:00Z')).toEqual(['req-3', 'req-2']);
    expect(await ids(`actorId=${actorA}&action=created`)).toEqual(['req-5']); // filters combine
  });

  it('pages through everything exactly once', async () => {
    const seen: string[] = [];
    for (let page = 1; ; page += 1) {
      const res = await call(`/admin/audit-logs?limit=2&page=${page}`, reader).expect(200);
      seen.push(...res.body.data.items.map((e: { id: string }) => e.id));
      if (!res.body.data.pagination.hasNext) break;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(await logs.countDocuments());
  });

  it('rejects bad queries with 422', async () => {
    const reversed = await call('/admin/audit-logs?from=2026-03-05T00:00:00Z&to=2026-03-01T00:00:00Z', reader).expect(422);
    expect(reversed.body.error.code).toBe('QUERY_INVALID');
    await call('/admin/audit-logs?actorId=nope', reader).expect(422);
    await call('/admin/audit-logs?resourceId=123', reader).expect(422);
    await call('/admin/audit-logs?actorType=ROBOT', reader).expect(422);
    await call('/admin/audit-logs?from=yesterday', reader).expect(422);
    await call('/admin/audit-logs?limit=500', reader).expect(422);
    await call('/admin/audit-logs?unknown=1', reader).expect(422);
  });
});

describe('GET /admin/audit-logs/:id', () => {
  it('returns one entry with before/after', async () => {
    const list = await call('/admin/audit-logs?action=USER_SUSPENDED', reader);
    const id = list.body.data.items[0].id;
    const res = await call(`/admin/audit-logs/${id}`, reader).expect(200);
    expect(res.body.data).toMatchObject({ id, action: 'USER_SUSPENDED', before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED', reason: 'spam' }, actor: { email: 'actor.a@example.test' } });
  });

  it('answers 404 for unknown and malformed ids', async () => {
    await call(`/admin/audit-logs/${oid()}`, reader).expect(404);
    const bad = await call('/admin/audit-logs/not-an-id', reader).expect(404);
    expect(bad.body.error.code).toBe('NOT_FOUND');
  });

  it('never shows secrets: values written under sensitive keys come back redacted', async () => {
    await env.app.get(AuditService).record({
      actorType: 'SYSTEM', action: 'SECRET_TEST', resourceType: 'thing', requestId: 'req-secret',
      before: { password: 'hunter2', nested: { refreshToken: 'abc', ok: 1 } },
      after: { otpCode: '123456', note: 'fine' },
    });
    const res = await call('/admin/audit-logs?action=SECRET_TEST', reader).expect(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/hunter2|"abc"|123456/);
    expect(res.body.data.items[0].before).toEqual({ password: '[REDACTED]', nested: { refreshToken: '[REDACTED]', ok: 1 } });
    expect(res.body.data.items[0].after.note).toBe('fine');
  });
});
