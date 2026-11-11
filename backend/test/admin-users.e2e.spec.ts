import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import { AccountStatus, Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { OutboxEvent } from '../src/modules/outbox/outbox-event.schema';
import { UserContentRef } from '../src/modules/admin-users/ports';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let audit: Model<AuditLog>;
let outbox: Model<OutboxEvent>;
const http = () => request(env.app.getHttpServer());
const call = (method: 'get' | 'patch', path: string, userId?: string, body?: object) => {
  const r = http()[method](`/api/v1${path}`);
  if (userId) r.set('Authorization', `Bearer ${env.token(userId)}`);
  return body ? r.send(body) : r;
};
const READ = [{ module: 'USERS' as const, actions: ['READ' as const] }];
const WRITE = [{ module: 'USERS' as const, actions: ['READ' as const, 'UPDATE' as const] }];
const REASON = 'Vi phạm quy định cộng đồng nhiều lần';

// TV3 stand-in: posts connected, everything else not.
const fakeContent = {
  count: async (kind: string) => (kind === 'posts' ? 3 : undefined),
  list: async (kind: string, _id: string, paging: { page: number; limit: number }) =>
    kind === 'posts'
      ? { items: [{ id: 'p1' }], pagination: { ...paging, total: 1, totalPages: 1, hasNext: false } }
      : undefined,
};

let viewer: string; // ADMIN with USERS.READ
let moderator: string; // ADMIN with USERS.READ + UPDATE
let root: string; // SUPER_ADMIN

beforeAll(async () => {
  env = await startEnv({ overrides: [{ provide: UserContentRef, useValue: fakeContent }] });
  audit = env.app.get(getModelToken(AuditLog.name));
  outbox = env.app.get(getModelToken(OutboxEvent.name));
  viewer = await env.createUser({ role: Role.ADMIN, permissions: READ });
  moderator = await env.createUser({ role: Role.ADMIN, permissions: WRITE });
  root = await env.createUser({ role: Role.SUPER_ADMIN });
});
afterAll(() => env.close());

describe('access control', () => {
  it('needs a token, an admin role and the USERS.READ permission', async () => {
    await call('get', '/admin/users').expect(401);
    const plain = await env.createUser();
    await call('get', '/admin/users', plain).expect(403);
    const noPerm = await env.createUser({ role: Role.ADMIN, permissions: [{ module: 'PLACES', actions: ['READ'] }] });
    await call('get', '/admin/users', noPerm).expect(403);
    await call('get', '/admin/users', viewer).expect(200);
  });

  it('a disabled admin profile is refused even with a valid token', async () => {
    const off = await env.createUser({ role: Role.ADMIN, permissions: READ, adminStatus: 'DISABLED' as never });
    await call('get', '/admin/users', off).expect(403);
  });
});

describe('GET /admin/users', () => {
  let alice: string;
  let bob: string;
  beforeAll(async () => {
    alice = await env.createUser({ email: 'alice.list@example.test' });
    bob = await env.createUser({ email: 'bob.list@example.test', status: AccountStatus.SUSPENDED });
    await env.users.updateOne(
      { _id: alice },
      { phoneNormalized: '+84901234567', 'profile.displayName': 'Alice Nguyen', 'profile.bio': 'secret bio', 'profile.dateOfBirth': '2000-01-01' },
    );
  });

  it('returns the Page<T> shape and hides private profile data', async () => {
    const res = await call('get', '/admin/users?q=alice.list', viewer).expect(200);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false });
    const user = res.body.data.items[0];
    expect(user).toMatchObject({ id: alice, email: 'alice.list@example.test', role: 'USER', status: 'ACTIVE' });
    expect(user.phone).toBe('+84*******67'); // masked
    const text = JSON.stringify(user);
    expect(text).not.toMatch(/secret bio|2000-01-01|passwordHash|privacy|notificationSettings/);
  });

  it('searches email, display name and exact id; special characters are plain text', async () => {
    expect((await call('get', '/admin/users?q=Nguyen', viewer)).body.data.pagination.total).toBe(1);
    expect((await call('get', `/admin/users?q=${alice}`, viewer)).body.data.items[0].id).toBe(alice);
    expect((await call('get', '/admin/users?q=.*', viewer)).body.data.pagination.total).toBe(0);
    expect((await call('get', '/admin/users?q=(', viewer).expect(200)).body.data.items).toEqual([]);
  });

  it('filters by status, role and creation date', async () => {
    const suspended = await call('get', '/admin/users?status=SUSPENDED&q=list', viewer).expect(200);
    expect(suspended.body.data.items.map((u: { id: string }) => u.id)).toEqual([bob]);
    const admins = await call('get', '/admin/users?role=SUPER_ADMIN', viewer).expect(200);
    expect(admins.body.data.items.every((u: { role: string }) => u.role === 'SUPER_ADMIN')).toBe(true);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await call('get', `/admin/users?createdFrom=${encodeURIComponent(future)}`, viewer)).body.data.pagination.total).toBe(0);
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect((await call('get', `/admin/users?createdFrom=${encodeURIComponent(past)}&q=list`, viewer)).body.data.pagination.total).toBe(2);
  });

  it('pages without repeating or skipping rows, and sorts', async () => {
    const seen: string[] = [];
    let page = 1;
    for (;;) {
      const res = await call('get', `/admin/users?limit=2&page=${page}&sort=createdAt`, viewer).expect(200);
      seen.push(...res.body.data.items.map((u: { id: string }) => u.id));
      if (!res.body.data.pagination.hasNext) break;
      page += 1;
    }
    expect(new Set(seen).size).toBe(seen.length);
    const total = (await call('get', '/admin/users', viewer)).body.data.pagination.total;
    expect(seen.length).toBe(total);
    const desc = await call('get', '/admin/users?sort=-createdAt&limit=3', viewer);
    const dates = desc.body.data.items.map((u: { createdAt: string }) => u.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('rejects bad queries with 422', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const reversed = await call('get', `/admin/users?createdFrom=${encodeURIComponent(future)}&createdTo=${encodeURIComponent(past)}`, viewer).expect(422);
    expect(reversed.body.error.code).toBe('QUERY_INVALID');
    await call('get', '/admin/users?limit=101', viewer).expect(422);
    await call('get', '/admin/users?page=0', viewer).expect(422);
    await call('get', '/admin/users?status=NOPE', viewer).expect(422);
    await call('get', '/admin/users?sort=password', viewer).expect(422);
    await call('get', '/admin/users?unknown=1', viewer).expect(422);
  });
});

describe('GET /admin/users/:id', () => {
  it('returns the redacted user, the counts that are connected and the moderation history', async () => {
    const target = await env.createUser({ email: 'detail@example.test' });
    const res = await call('get', `/admin/users/${target}`, viewer).expect(200);
    expect(res.body.data.user.id).toBe(target);
    expect(res.body.data.postCount).toBe(3);
    // Owners that are not connected: the count is left out instead of being invented.
    expect(res.body.data).not.toHaveProperty('reviewCount');
    expect(res.body.data).not.toHaveProperty('documentCount');
    expect(res.body.data.moderationHistory).toEqual([]);
  });

  it('answers 404 for unknown and malformed ids', async () => {
    await call('get', `/admin/users/${'f'.repeat(24)}`, viewer).expect(404);
    const bad = await call('get', '/admin/users/not-an-id', viewer).expect(404);
    expect(bad.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /admin/users/:id/status', () => {
  const patch = (actor: string, target: string, body: object) => call('patch', `/admin/users/${target}/status`, actor, body);

  it('needs USERS.UPDATE and validates the body', async () => {
    const target = await env.createUser();
    await patch(viewer, target, { action: 'SUSPEND', reason: REASON }).expect(403);
    const short = await patch(moderator, target, { action: 'SUSPEND', reason: 'quá ngắn' }).expect(422);
    expect(short.body.error.details[0]).toMatchObject({ field: 'reason' });
    await patch(moderator, target, { action: 'BAN', reason: REASON }).expect(422);
    await patch(moderator, target, { action: 'SUSPEND' }).expect(422);
    expect((await env.users.findById(target))?.status).toBe(AccountStatus.ACTIVE);
  });

  it('suspends: ends sessions, writes audit + outbox, appears in history and violations', async () => {
    const target = await env.createUser();
    const res = await patch(moderator, target, { action: 'SUSPEND', reason: REASON }).expect(200);
    expect(res.body.data.status).toBe('SUSPENDED');
    // The user's existing login stops working at once.
    const me = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${env.token(target)}`);
    expect([401, 403]).toContain(me.status);
    expect(await env.sessions.countDocuments({ userId: target, revokedAt: null })).toBe(0);

    const log = await audit.findOne({ action: 'USER_SUSPENDED', resourceId: target });
    expect(log).toMatchObject({ actorType: 'ADMIN', before: { status: 'ACTIVE' }, after: { status: 'SUSPENDED', reason: REASON } });
    expect(String(log?.actorId)).toBe(moderator);
    const event = await outbox.findOne({ eventType: 'USER_STATUS_CHANGED', aggregateId: target });
    expect(event?.payload).toEqual({ action: 'SUSPEND' }); // the reason never leaves the audit log

    const detail = await call('get', `/admin/users/${target}`, viewer);
    expect(detail.body.data.moderationHistory.map((e: { action: string }) => e.action)).toEqual(['USER_SUSPENDED']);
    const violations = await call('get', `/admin/users/${target}/violations`, viewer).expect(200);
    expect(violations.body.data.items[0]).toMatchObject({ action: 'USER_SUSPENDED', resourceId: target });
  });

  it('refuses invalid transitions with 409 and keeps the state', async () => {
    const target = await env.createUser();
    await patch(moderator, target, { action: 'UNSUSPEND', reason: REASON }).expect(409);
    await patch(moderator, target, { action: 'SUSPEND', reason: REASON }).expect(200);
    const again = await patch(moderator, target, { action: 'SUSPEND', reason: REASON }).expect(409);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
    const deleted = await env.createUser({ status: AccountStatus.DELETED });
    await patch(moderator, deleted, { action: 'SUSPEND', reason: REASON }).expect(409);
    const asking = await env.createUser({ status: AccountStatus.DELETION_REQUESTED });
    await patch(moderator, asking, { action: 'SUSPEND', reason: REASON }).expect(409);
  });

  it('unsuspends back to ACTIVE, or to PENDING_VERIFICATION when the email was never verified', async () => {
    const target = await env.createUser();
    await patch(moderator, target, { action: 'SUSPEND', reason: REASON }).expect(200);
    const back = await patch(moderator, target, { action: 'UNSUSPEND', reason: REASON }).expect(200);
    expect(back.body.data.status).toBe('ACTIVE');
    expect(await audit.countDocuments({ action: 'USER_UNSUSPENDED', resourceId: target })).toBe(1);

    const unverified = await env.createUser({ status: AccountStatus.PENDING_VERIFICATION });
    await env.users.updateOne({ _id: unverified }, { emailVerified: false });
    await patch(moderator, unverified, { action: 'SUSPEND', reason: REASON }).expect(200);
    const res = await patch(moderator, unverified, { action: 'UNSUSPEND', reason: REASON }).expect(200);
    expect(res.body.data.status).toBe('PENDING_VERIFICATION');
  });

  it('protects accounts: not yourself, not a Super Admin, admins only by a Super Admin', async () => {
    const self = await patch(moderator, moderator, { action: 'SUSPEND', reason: REASON }).expect(403);
    expect(self.body.error.code).toBe('FORBIDDEN');
    await patch(moderator, root, { action: 'SUSPEND', reason: REASON }).expect(403);
    await patch(root, root, { action: 'SUSPEND', reason: REASON }).expect(403);
    const otherAdmin = await env.createUser({ role: Role.ADMIN, permissions: READ });
    await patch(moderator, otherAdmin, { action: 'SUSPEND', reason: REASON }).expect(403);
    await patch(root, otherAdmin, { action: 'SUSPEND', reason: REASON }).expect(200);
    await patch(root, 'f'.repeat(24), { action: 'SUSPEND', reason: REASON }).expect(404);
  });

  it('of two admins acting at the same moment only one succeeds', async () => {
    const target = await env.createUser();
    const results = await Promise.all([
      patch(moderator, target, { action: 'SUSPEND', reason: REASON }),
      patch(root, target, { action: 'SUSPEND', reason: REASON }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await audit.countDocuments({ action: 'USER_SUSPENDED', resourceId: target })).toBe(1);
  });
});

describe('activity, violations and content tabs', () => {
  it('lists what the user did (as actor) with paging', async () => {
    const target = await env.createUser();
    for (let i = 0; i < 3; i += 1) {
      await audit.create({ actorId: target, actorType: 'USER', action: `THING_${i}`, resourceType: 'post', requestId: `r${i}` });
    }
    const res = await call('get', `/admin/users/${target}/activity?limit=2`, viewer).expect(200);
    expect(res.body.data.items.map((e: { action: string }) => e.action)).toEqual(['THING_2', 'THING_1']);
    expect(res.body.data.pagination).toMatchObject({ total: 3, hasNext: true });
    await call('get', `/admin/users/${'f'.repeat(24)}/activity`, viewer).expect(404);
  });

  it('serves content of connected owners and says 503 for the rest', async () => {
    const target = await env.createUser();
    const posts = await call('get', `/admin/users/${target}/posts`, viewer).expect(200);
    expect(posts.body.data.items).toEqual([{ id: 'p1' }]);
    for (const kind of ['documents', 'reviews', 'suggestions']) {
      const res = await call('get', `/admin/users/${target}/${kind}`, viewer).expect(503);
      expect(res.body.error.code).toBe('CONTENT_NOT_CONNECTED');
    }
  });
});
