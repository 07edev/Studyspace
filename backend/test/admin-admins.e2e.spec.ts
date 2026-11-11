import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import { AdminStatus, Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { DevMailService, MailService } from '../src/modules/auth/mail.service';
import { AdminProfile } from '../src/modules/identity/schemas/admin-profile.schema';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let audit: Model<AuditLog>;
let profiles: Model<AdminProfile>;
let mail: DevMailService;
const http = () => request(env.app.getHttpServer());
type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
const call = (method: Method, path: string, userId?: string, body?: object) => {
  const r = http()[method](`/api/v1${path}`);
  if (userId) r.set('Authorization', `Bearer ${env.token(userId)}`);
  return body ? r.send(body) : r;
};
const USERS_READ = [{ module: 'USERS' as const, actions: ['READ' as const] }];
const PASSWORD = 'InvitedAdmin123';

let root: string;
beforeAll(async () => {
  env = await startEnv();
  audit = env.app.get(getModelToken(AuditLog.name));
  profiles = env.app.get(getModelToken(AdminProfile.name));
  mail = env.app.get(MailService) as DevMailService;
  root = await env.createUser({ role: Role.SUPER_ADMIN });
});
afterAll(() => env.close());

const invite = (body: object = {}, actor = root) =>
  call('post', '/admin/admins', actor, {
    displayName: 'Minh Quan',
    email: `new${Math.random().toString(36).slice(2, 8)}@example.test`,
    role: 'ADMIN',
    permissions: USERS_READ,
    ...body,
  });

describe('access control', () => {
  it('is for Super Admin only, whatever permissions an admin has', async () => {
    await call('get', '/admin/admins').expect(401);
    const everything = await env.createUser({
      role: Role.ADMIN,
      permissions: [
        { module: 'USERS', actions: ['READ', 'UPDATE', 'CREATE', 'DELETE'] },
        { module: 'AUDIT', actions: ['READ'] },
      ],
    });
    const plain = await env.createUser();
    for (const actor of [everything, plain]) {
      await call('get', '/admin/admins', actor).expect(403);
      await invite({}, actor).expect(403);
      await call('delete', `/admin/admins/${root}`, actor).expect(403);
    }
  });
});

describe('POST /admin/admins (A08)', () => {
  it('creates an active admin without a password and sends an invitation without secrets', async () => {
    const email = 'invited.one@example.test';
    const res = await invite({ email, displayName: '  Linh Tran  ' }).expect(201);
    expect(res.body.data).toMatchObject({
      email,
      displayName: 'Linh Tran',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: USERS_READ,
      invitationSent: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    expect(mail.invites).toContain(email);
    const stored = await env.users.findById(res.body.data.id).select('+passwordHash');
    expect(stored?.passwordHash).toBeUndefined();
    const log = await audit.findOne({ action: 'ADMIN_CREATED', resourceId: res.body.data.id });
    expect(log).toMatchObject({ actorType: 'ADMIN', after: { email, role: 'ADMIN' } });
    // The new admin cannot sign in until they set a password.
    const early = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD, client: 'WEB_ADMIN' });
    expect(early.status).toBe(401);
  });

  it('lets the invited person set a password through "forgot password" and then sign in with their permissions', async () => {
    const email = 'invited.two@example.test';
    await invite({ email }).expect(201);
    await http().post('/api/v1/auth/password/forgot').send({ email }).expect(202);
    const otp = env.otp(email, 'PASSWORD_RESET')!;
    const grant = await http().post('/api/v1/auth/password/verify-otp').send({ email, otp }).expect(200);
    await http()
      .post('/api/v1/auth/password/reset')
      .send({ resetToken: grant.body.data.resetToken, newPassword: PASSWORD, confirmPassword: PASSWORD })
      .expect(200);
    const login = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD, client: 'WEB_ADMIN' }).expect(200);
    expect(login.body.data.user).toMatchObject({ role: 'ADMIN', emailVerified: true, admin: { status: 'ACTIVE', permissions: USERS_READ } });
    const list = await http().get('/api/v1/admin/users').set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`);
    expect(list.status).toBe(200); // the granted permission works
    const denied = await http().get('/api/v1/admin/admins').set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`);
    expect(denied.status).toBe(403);
  });

  it('still creates the account when the email cannot be delivered, and says so', async () => {
    const original = mail.sendAdminInvite.bind(mail);
    mail.sendAdminInvite = async () => {
      throw new Error('smtp down');
    };
    try {
      const res = await invite().expect(201);
      expect(res.body.data.invitationSent).toBe(false);
    } finally {
      mail.sendAdminInvite = original;
    }
  });

  it('refuses an email that already exists (any case) with 409 and creates nothing', async () => {
    const existing = await env.createUser({ email: 'taken@example.test' });
    const before = await profiles.countDocuments();
    for (const email of ['taken@example.test', 'TAKEN@Example.test']) {
      const res = await invite({ email }).expect(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(res.body.error.details[0].field).toBe('email');
    }
    expect(await profiles.countDocuments()).toBe(before);
    expect((await env.users.findById(existing))?.role).toBe('USER'); // never silently promoted
  });

  it('validates the body', async () => {
    await invite({ displayName: 'A' }).expect(422);
    await invite({ email: 'nope' }).expect(422);
    await invite({ role: 'SUPER_ADMIN' }).expect(422);
    await invite({ permissions: undefined }).expect(422);
    await invite({ extra: true }).expect(422);
  });

  it('refuses bad permissions with INVALID_PERMISSION', async () => {
    const bad: unknown[] = [
      [{ module: 'NOPE', actions: ['READ'] }],
      [{ module: 'USERS', actions: ['FLY'] }],
      [{ module: 'USERS', actions: [] }],
      [{ module: 'USERS', actions: ['READ', 'READ'] }],
      [{ module: 'USERS', actions: ['READ'] }, { module: 'USERS', actions: ['UPDATE'] }],
      [{ module: 'ADMINS', actions: ['READ'] }],
      [{ module: 'USERS', actions: ['READ'], extra: 1 }],
      ['USERS'],
    ];
    for (const permissions of bad) {
      const res = await invite({ permissions }).expect(422);
      expect(res.body.error.code).toBe('INVALID_PERMISSION');
    }
  });

  it('stores permissions in a canonical order', async () => {
    const res = await invite({
      permissions: [
        { module: 'POSTS', actions: ['UPDATE', 'READ'] },
        { module: 'USERS', actions: ['READ'] },
      ],
    }).expect(201);
    expect(res.body.data.permissions).toEqual([
      { module: 'USERS', actions: ['READ'] },
      { module: 'POSTS', actions: ['READ', 'UPDATE'] },
    ]);
  });
});

describe('list and get', () => {
  it('lists admins and super admins with paging, newest first', async () => {
    await invite().expect(201);
    const res = await call('get', '/admin/admins?limit=2', root).expect(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.pagination.hasNext).toBe(true);
    const item = res.body.data.items[0];
    expect(item).toEqual(expect.objectContaining({ id: expect.any(String), email: expect.any(String), role: expect.any(String), status: 'ACTIVE', permissions: expect.any(Array) }));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('gets one admin and answers 404 for unknown ids, malformed ids and plain users', async () => {
    const created = await invite().expect(201);
    await call('get', `/admin/admins/${created.body.data.id}`, root).expect(200);
    await call('get', `/admin/admins/${'f'.repeat(24)}`, root).expect(404);
    await call('get', '/admin/admins/nope', root).expect(404);
    const plain = await env.createUser();
    await call('get', `/admin/admins/${plain}`, root).expect(404);
  });
});

describe('PATCH /admin/admins/:id (A09)', () => {
  const make = async () => (await invite().expect(201)).body.data.id as string;

  it('changes the display name and records before/after', async () => {
    const id = await make();
    const res = await call('patch', `/admin/admins/${id}`, root, { displayName: 'Tên Mới' }).expect(200);
    expect(res.body.data.displayName).toBe('Tên Mới');
    const log = await audit.findOne({ action: 'ADMIN_UPDATED', resourceId: id });
    expect(log).toMatchObject({ before: { displayName: 'Minh Quan' }, after: { displayName: 'Tên Mới' } });
  });

  it('needs at least one change and valid values', async () => {
    const id = await make();
    await call('patch', `/admin/admins/${id}`, root, {}).expect(422);
    await call('patch', `/admin/admins/${id}`, root, { displayName: 'x' }).expect(422);
    await call('patch', `/admin/admins/${id}`, root, { status: 'GONE' }).expect(422);
    await call('patch', `/admin/admins/${id}`, root, { role: 'SUPER_ADMIN' }).expect(422);
  });

  it('disables an admin: sessions end at once, enabling brings access back, repeats are 409', async () => {
    const id = await env.createUser({ role: Role.ADMIN, permissions: USERS_READ });
    await call('get', '/admin/users', id).expect(200);
    const off = await call('patch', `/admin/admins/${id}`, root, { status: 'DISABLED' }).expect(200);
    expect(off.body.data.status).toBe('DISABLED');
    expect([401, 403]).toContain((await call('get', '/admin/users', id)).status); // old token no longer works
    expect(await env.sessions.countDocuments({ userId: id, revokedAt: null })).toBe(0);
    const again = await call('patch', `/admin/admins/${id}`, root, { status: 'DISABLED' }).expect(409);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
    await call('patch', `/admin/admins/${id}`, root, { status: 'ACTIVE' }).expect(200);
    expect((await profiles.findOne({ userId: id }))?.status).toBe('ACTIVE');
  });

  it('does not let anyone disable themselves', async () => {
    const res = await call('patch', `/admin/admins/${root}`, root, { status: 'DISABLED' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await profiles.findOne({ userId: root }))?.status).toBe('ACTIVE');
    await call('patch', `/admin/admins/${root}`, root, { displayName: 'Root Admin' }).expect(200); // renaming yourself is fine
  });

  it('does not give permissions to a Super Admin', async () => {
    const other = await env.createUser({ role: Role.SUPER_ADMIN });
    await call('patch', `/admin/admins/${other}`, root, { permissions: USERS_READ }).expect(403);
  });
});

describe('PUT /admin/admins/:id/permissions (A10)', () => {
  it('replaces the whole list and takes effect on the very next request', async () => {
    const id = await env.createUser({
      role: Role.ADMIN,
      permissions: [{ module: 'USERS', actions: ['READ'] }, { module: 'PLACES', actions: ['READ'] }],
    });
    await call('get', '/admin/users', id).expect(200);
    const res = await call('put', `/admin/admins/${id}/permissions`, root, {
      permissions: [{ module: 'PLACES', actions: ['READ', 'UPDATE'] }],
    }).expect(200);
    expect(res.body.data.permissions).toEqual([{ module: 'PLACES', actions: ['READ', 'UPDATE'] }]);
    await call('get', '/admin/users', id).expect(403); // USERS was removed, same token, no re-login
    const log = await audit.findOne({ action: 'ADMIN_PERMISSIONS_REPLACED', resourceId: id });
    expect(log?.before).toEqual({ permissions: [{ module: 'USERS', actions: ['READ'] }, { module: 'PLACES', actions: ['READ'] }] });
  });

  it('can empty the list, requires the field, and refuses invalid entries without changing anything', async () => {
    const id = await env.createUser({ role: Role.ADMIN, permissions: USERS_READ });
    await call('put', `/admin/admins/${id}/permissions`, root, {}).expect(422);
    const bad = await call('put', `/admin/admins/${id}/permissions`, root, { permissions: [{ module: 'USERS', actions: ['FLY'] }] }).expect(422);
    expect(bad.body.error.code).toBe('INVALID_PERMISSION');
    expect((await profiles.findOne({ userId: id }))?.permissions).toEqual(USERS_READ);
    const cleared = await call('put', `/admin/admins/${id}/permissions`, root, { permissions: [] }).expect(200);
    expect(cleared.body.data.permissions).toEqual([]);
  });

  it('ignores other fields: only permissions are replaced', async () => {
    const id = await env.createUser({ role: Role.ADMIN, permissions: USERS_READ });
    await call('put', `/admin/admins/${id}/permissions`, root, { permissions: [], status: 'DISABLED' }).expect(200);
    expect((await profiles.findOne({ userId: id }))?.status).toBe('ACTIVE');
  });
});

describe('DELETE /admin/admins/:id (A11)', () => {
  it('removes admin rights: the account stays as a normal user, sessions end, audit is written', async () => {
    const id = await env.createUser({ role: Role.ADMIN, permissions: USERS_READ });
    await call('delete', `/admin/admins/${id}`, root).expect(204);
    expect((await env.users.findById(id))?.role).toBe('USER');
    expect(await profiles.countDocuments({ userId: id })).toBe(0);
    expect(await env.sessions.countDocuments({ userId: id, revokedAt: null })).toBe(0);
    expect([401, 403]).toContain((await call('get', '/admin/users', id)).status);
    await call('get', `/admin/admins/${id}`, root).expect(404);
    const log = await audit.findOne({ action: 'ADMIN_REMOVED', resourceId: id });
    expect(log).toMatchObject({ before: { role: 'ADMIN', status: 'ACTIVE' }, after: { role: 'USER' } });
    await call('delete', `/admin/admins/${id}`, root).expect(404); // already gone
  });

  it('never lets someone remove themselves, so the last Super Admin always stays', async () => {
    const solo = await env.createUser({ role: Role.SUPER_ADMIN });
    const res = await call('delete', `/admin/admins/${solo}`, solo).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await env.users.findById(solo))?.role).toBe('SUPER_ADMIN');
  });

  it('lets a Super Admin remove another Super Admin', async () => {
    const other = await env.createUser({ role: Role.SUPER_ADMIN });
    await call('delete', `/admin/admins/${other}`, root).expect(204);
    expect((await env.users.findById(other))?.role).toBe('USER');
  });

  it('two Super Admins removing each other at the same moment leave exactly one', async () => {
    const a = await env.createUser({ role: Role.SUPER_ADMIN });
    const b = await env.createUser({ role: Role.SUPER_ADMIN });
    const results = await Promise.all([call('delete', `/admin/admins/${b}`, a), call('delete', `/admin/admins/${a}`, b)]);
    expect(results.map(r => r.status).sort()).toEqual([204, 403]);
    const remaining = await env.users.countDocuments({ _id: { $in: [a, b] }, role: Role.SUPER_ADMIN });
    expect(remaining).toBe(1);
  });

  it('two Super Admins disabling each other at the same moment leave exactly one active', async () => {
    const a = await env.createUser({ role: Role.SUPER_ADMIN });
    const b = await env.createUser({ role: Role.SUPER_ADMIN });
    const results = await Promise.all([
      call('patch', `/admin/admins/${b}`, a, { status: 'DISABLED' }),
      call('patch', `/admin/admins/${a}`, b, { status: 'DISABLED' }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 403]);
    expect(await profiles.countDocuments({ userId: { $in: [a, b] }, status: AdminStatus.ACTIVE })).toBe(1);
  });
});
