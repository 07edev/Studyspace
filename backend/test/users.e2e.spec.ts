import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import { ApiException } from '../src/common/api-error';
import { AccountStatus } from '../src/common/enums';
import { UserDevice } from '../src/modules/identity/schemas/user-device.schema';
import { FileReadyRef, TaxonomyRef } from '../src/modules/users/ports';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let devices: Model<UserDevice>;
const http = () => request(env.app.getHttpServer());
const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token?: string, body?: object) => {
  const r = http()[method](`/api/v1${path}`);
  if (token) {
    r.set('Authorization', `Bearer ${token}`);
  }
  return body ? r.send(body) : r;
};
const as = (userId: string) => env.token(userId);
const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);
const ID_C = 'c'.repeat(24);
const ID_D = 'd'.repeat(24);

// Stand-ins for TV2/TV3 so the TV1 side can be tested without their modules.
const taxonomyCalls: unknown[] = [];
const fakeTaxonomy = {
  assertValid: async (input: { universityId?: string; majorId?: string; subjectIds?: string[] }) => {
    taxonomyCalls.push(input);
    if (input.majorId === ID_D && input.universityId !== ID_C) {
      throw new ApiException(422, 'UNIVERSITY_MAJOR_MISMATCH', 'Ngành không thuộc trường đã chọn.');
    }
  },
};
const fakeFiles = {
  assertReady: async (fileId: string, ownerId: string) => {
    if (fileId !== ID_A || !ownerId) {
      throw new ApiException(409, 'FILE_NOT_READY', 'Tệp chưa sẵn sàng.');
    }
  },
};

beforeAll(async () => {
  env = await startEnv({
    overrides: [
      { provide: TaxonomyRef, useValue: fakeTaxonomy },
      { provide: FileReadyRef, useValue: fakeFiles },
    ],
  });
  devices = env.app.get<Model<UserDevice>>(getModelToken(UserDevice.name));
});
afterAll(async () => {
  await env.close();
});

describe('GET /users/me', () => {
  test('returns the signed-in user and never any secret', async () => {
    const id = await env.createUser({ password: 'Str0ngPassw0rd' });
    const res = await call('get', '/users/me', as(id));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, role: 'USER', status: 'ACTIVE', emailVerified: true });
    expect(res.body.data.profile.displayName).toMatch(/^User /);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshTokenHash/);
  });

  test('401 without a token', async () => {
    const res = await call('get', '/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('a suspended account is refused immediately', async () => {
    const id = await env.createUser({ status: AccountStatus.SUSPENDED });
    const res = await call('get', '/users/me', as(id));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /users/me/profile', () => {
  test('changes only the sent fields and keeps the rest', async () => {
    const id = await env.createUser();
    const first = await call('patch', '/users/me/profile', as(id), {
      displayName: '  Nguyễn Văn An  ',
      bio: 'Thích học nhóm',
      hometown: 'Đà Nẵng',
      dateOfBirth: '2003-05-17',
      locationMode: 'MANUAL',
      location: { lat: 16.05, lng: 108.2 },
    });
    expect(first.status).toBe(200);
    expect(first.body.data.profile).toMatchObject({
      displayName: 'Nguyễn Văn An',
      bio: 'Thích học nhóm',
      hometown: 'Đà Nẵng',
      dateOfBirth: '2003-05-17',
      locationMode: 'MANUAL',
      location: { lat: 16.05, lng: 108.2 },
    });
    const second = await call('patch', '/users/me/profile', as(id), { bio: 'Đã đổi' });
    expect(second.body.data.profile).toMatchObject({ displayName: 'Nguyễn Văn An', bio: 'Đã đổi', hometown: 'Đà Nẵng' });
    const stored = await env.users.findById(id).lean();
    expect((stored?.profile as Record<string, unknown>).bio).toBe('Đã đổi');
  });

  test('null or an empty string clears an optional field, but never the display name', async () => {
    const id = await env.createUser();
    await call('patch', '/users/me/profile', as(id), { bio: 'x', hometown: 'Huế', dateOfBirth: '2002-01-01' });
    const res = await call('patch', '/users/me/profile', as(id), { bio: '   ', hometown: null, dateOfBirth: null });
    expect(res.status).toBe(200);
    expect(res.body.data.profile).not.toHaveProperty('bio');
    expect(res.body.data.profile).not.toHaveProperty('hometown');
    expect(res.body.data.profile).not.toHaveProperty('dateOfBirth');
    const blank = await call('patch', '/users/me/profile', as(id), { displayName: '   ' });
    expect(blank.status).toBe(422);
    expect(blank.body.error.details[0].field).toBe('displayName');
  });

  test('reports every invalid field in Vietnamese', async () => {
    const id = await env.createUser();
    const res = await call('patch', '/users/me/profile', as(id), {
      displayName: 'A',
      dateOfBirth: '2999-01-01',
      bio: 'x'.repeat(501),
      subjectIds: ['not-an-id', 'not-an-id'],
      locationMode: 'SOMEWHERE',
      location: { lat: 123, lng: 0 },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['displayName', 'dateOfBirth', 'bio', 'subjectIds', 'locationMode', 'location.lat']),
    );
    expect(JSON.stringify(res.body.error.details)).not.toMatch(/must be|should/);
  });

  test('rejects an impossible calendar date, and fields the client may not set', async () => {
    const id = await env.createUser();
    const date = await call('patch', '/users/me/profile', as(id), { dateOfBirth: '2003-02-31' });
    expect(date.status).toBe(422);
    const sneaky = await call('patch', '/users/me/profile', as(id), { role: 'SUPER_ADMIN', status: 'ACTIVE' });
    expect(sneaky.status).toBe(422);
    expect((await env.users.findById(id).lean())?.role).toBe('USER');
  });

  test('rejects more than 30 subjects', async () => {
    const id = await env.createUser();
    const ids = Array.from({ length: 31 }, (_, i) => i.toString(16).padStart(24, '0'));
    const res = await call('patch', '/users/me/profile', as(id), { subjectIds: ids });
    expect(res.status).toBe(422);
  });

  test('university, major and subjects are checked by TV2 with the merged values', async () => {
    const id = await env.createUser();
    taxonomyCalls.length = 0;
    const ok = await call('patch', '/users/me/profile', as(id), { universityId: ID_C, subjectIds: [ID_A, ID_B] });
    expect(ok.status).toBe(200);
    expect(taxonomyCalls[0]).toEqual({ universityId: ID_C, majorId: undefined, subjectIds: [ID_A, ID_B] });
    // Changing only the major re-checks it against the university already saved.
    const changed = await call('patch', '/users/me/profile', as(id), { majorId: ID_B });
    expect(taxonomyCalls[1]).toMatchObject({ universityId: ID_C, majorId: ID_B });
    expect(changed.status).toBe(200);
    const bad = await call('patch', '/users/me/profile', as(id), { universityId: ID_A, majorId: ID_D });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('UNIVERSITY_MAJOR_MISMATCH');
    // Nothing was saved by the failed request.
    const stored = (await env.users.findById(id).lean())?.profile as Record<string, unknown>;
    expect(stored.universityId).toBe(ID_C);
    expect(stored.majorId).toBe(ID_B);
  });

  test('a major without any university is refused before asking TV2', async () => {
    const id = await env.createUser();
    taxonomyCalls.length = 0;
    const res = await call('patch', '/users/me/profile', as(id), { majorId: ID_B });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNIVERSITY_MAJOR_MISMATCH');
    expect(taxonomyCalls).toHaveLength(0);
  });

  test('the avatar is applied only when TV3 says the file is ready', async () => {
    const id = await env.createUser();
    const notReady = await call('patch', '/users/me/profile', as(id), { avatarFileId: ID_B });
    expect(notReady.status).toBe(409);
    expect(notReady.body.error.code).toBe('FILE_NOT_READY');
    expect((await env.users.findById(id).lean())?.profile).not.toHaveProperty('avatarFileId');
    const ready = await call('patch', '/users/me/profile', as(id), { avatarFileId: ID_A });
    expect(ready.status).toBe(200);
    expect(ready.body.data.profile.avatarFileId).toBe(ID_A);
  });
});

describe('before TV2/TV3 are connected', () => {
  let bare: TestEnv;
  beforeAll(async () => {
    bare = await startEnv();
  });
  afterAll(async () => {
    await bare.close();
  });

  test('taxonomy and avatar changes answer 503 instead of trusting unchecked ids', async () => {
    const id = await bare.createUser();
    const send = (body: object) =>
      request(bare.app.getHttpServer())
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${bare.token(id)}`)
        .send(body);
    const taxonomy = await send({ universityId: ID_A });
    expect(taxonomy.status).toBe(503);
    expect(taxonomy.body.error.code).toBe('TAXONOMY_NOT_CONNECTED');
    const avatar = await send({ avatarFileId: ID_A });
    expect(avatar.status).toBe(503);
    expect(avatar.body.error.code).toBe('FILE_SERVICE_NOT_CONNECTED');
    // Plain profile fields still work.
    expect((await send({ bio: 'ok' })).status).toBe(200);
  });
});

describe('privacy settings', () => {
  test('defaults, partial update and persistence', async () => {
    const id = await env.createUser();
    const initial = await call('get', '/users/me/privacy', as(id));
    expect(initial.body.data).toEqual({ profileVisibility: 'PUBLIC', showUniversity: true, showMajor: true });
    const res = await call('patch', '/users/me/privacy', as(id), { profileVisibility: 'PRIVATE', showMajor: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ profileVisibility: 'PRIVATE', showUniversity: true, showMajor: false });
    const again = await call('get', '/users/me/privacy', as(id));
    expect(again.body.data).toEqual(res.body.data);
  });

  test('reads the first-draft `visibility` key and rejects bad values', async () => {
    const id = await env.createUser();
    await env.users.updateOne({ _id: id }, { $set: { privacy: { visibility: 'PRIVATE', showUniversity: false, showMajor: true } } });
    const legacy = await call('get', '/users/me/privacy', as(id));
    expect(legacy.body.data).toEqual({ profileVisibility: 'PRIVATE', showUniversity: false, showMajor: true });
    const bad = await call('patch', '/users/me/privacy', as(id), { profileVisibility: 'FRIENDS', showMajor: 'yes' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['profileVisibility', 'showMajor']),
    );
  });

  test('needs a signed-in user', async () => {
    expect((await call('get', '/users/me/privacy')).status).toBe(401);
    expect((await call('patch', '/users/me/privacy', undefined, { showMajor: false })).status).toBe(401);
  });
});

describe('notification settings', () => {
  test('defaults, partial update and persistence', async () => {
    const id = await env.createUser();
    const initial = await call('get', '/users/me/notification-settings', as(id));
    expect(initial.body.data).toEqual({
      postInteraction: true,
      moderation: true,
      adminMessage: true,
      system: true,
      pushEnabled: false,
    });
    const res = await call('patch', '/users/me/notification-settings', as(id), { pushEnabled: true, system: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      postInteraction: true,
      moderation: true,
      adminMessage: true,
      system: false,
      pushEnabled: true,
    });
    const again = await call('get', '/users/me/notification-settings', as(id));
    expect(again.body.data).toEqual(res.body.data);
  });

  test('rejects non-boolean values and unknown keys', async () => {
    const id = await env.createUser();
    const res = await call('patch', '/users/me/notification-settings', as(id), { system: 'no', sms: true });
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['system', 'sms']),
    );
  });
});

describe('GET /users/:userId/public-profile', () => {
  const profileOf = async (id: string, patch: object, privacy?: object) => {
    await env.users.updateOne(
      { _id: id },
      { $set: { profile: { displayName: 'Lan Anh', bio: 'Xin chào', universityId: ID_C, majorId: ID_B, ...patch }, ...(privacy ? { privacy } : {}) } },
    );
  };

  test('is open to everyone and shows the allowed fields only', async () => {
    const id = await env.createUser({ email: 'private-mail@example.test' });
    await profileOf(id, {}, { profileVisibility: 'PUBLIC', showUniversity: true, showMajor: false });
    const res = await call('get', `/users/${id}/public-profile`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id, displayName: 'Lan Anh', bio: 'Xin chào', universityId: ID_C });
    expect(JSON.stringify(res.body)).not.toMatch(/private-mail|phone|email|dateOfBirth|passwordHash/);
  });

  test('a private profile shows only the author identity', async () => {
    const id = await env.createUser();
    await profileOf(id, {}, { profileVisibility: 'PRIVATE', showUniversity: true, showMajor: true });
    const res = await call('get', `/users/${id}/public-profile`);
    expect(res.body.data).toEqual({ id, displayName: 'Lan Anh' });
  });

  test('suspended, unknown or malformed ids are all 404', async () => {
    const suspended = await env.createUser({ status: AccountStatus.SUSPENDED });
    expect((await call('get', `/users/${suspended}/public-profile`)).status).toBe(404);
    expect((await call('get', `/users/${'0'.repeat(24)}/public-profile`)).status).toBe(404);
    const bad = await call('get', '/users/not-an-id/public-profile');
    expect(bad.status).toBe(404);
    expect(bad.body.error.code).toBe('NOT_FOUND');
  });
});

describe('devices', () => {
  const token = (suffix: string) => `push-token-${suffix}`.padEnd(40, 'x');

  test('registering is idempotent per token and stores only a hash for lookup', async () => {
    const id = await env.createUser();
    const first = await call('post', '/users/me/devices', as(id), { platform: 'ANDROID', pushToken: token('one') });
    expect(first.status).toBe(201);
    expect(first.body.data.deviceId).toMatch(/^[a-f0-9]{24}$/);
    const second = await call('post', '/users/me/devices', as(id), { platform: 'ANDROID', pushToken: token('one') });
    expect(second.body.data.deviceId).toBe(first.body.data.deviceId);
    expect(await devices.countDocuments({ userId: id })).toBe(1);
    const row = await devices.findById(first.body.data.deviceId).lean();
    expect(row?.pushTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row).not.toHaveProperty('pushToken'); // select:false keeps the raw token out of normal reads
    expect(JSON.stringify(first.body)).not.toContain(token('one'));
  });

  test('a phone moving to another account stops notifying the old one', async () => {
    const a = await env.createUser();
    const b = await env.createUser();
    await call('post', '/users/me/devices', as(a), { platform: 'ANDROID', pushToken: token('shared') });
    await call('post', '/users/me/devices', as(b), { platform: 'ANDROID', pushToken: token('shared') });
    expect(await devices.countDocuments({ userId: a })).toBe(0);
    expect(await devices.countDocuments({ userId: b })).toBe(1);
  });

  test('keeps at most 10 devices per user, dropping the oldest', async () => {
    const id = await env.createUser();
    for (let i = 0; i < 12; i += 1) {
      await call('post', '/users/me/devices', as(id), { platform: 'IOS', pushToken: token(`n${i}`) });
    }
    expect(await devices.countDocuments({ userId: id })).toBe(10);
  });

  test('validates the body', async () => {
    const id = await env.createUser();
    const res = await call('post', '/users/me/devices', as(id), { platform: 'WINDOWS', pushToken: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['platform', 'pushToken']),
    );
  });

  test('delete removes your own device (204) and nobody else\'s (404)', async () => {
    const owner = await env.createUser();
    const other = await env.createUser();
    const created = await call('post', '/users/me/devices', as(owner), { platform: 'ANDROID', pushToken: token('del') });
    const id = created.body.data.deviceId;
    expect((await call('delete', `/users/me/devices/${id}`, as(other))).status).toBe(404);
    expect(await devices.countDocuments({ _id: id })).toBe(1);
    const removed = await call('delete', `/users/me/devices/${id}`, as(owner));
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');
    expect((await call('delete', `/users/me/devices/${id}`, as(owner))).status).toBe(404);
    expect((await call('delete', '/users/me/devices/not-an-id', as(owner))).status).toBe(404);
  });
});
