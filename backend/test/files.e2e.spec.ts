import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { Model } from 'mongoose';
import { FileAsset } from '../src/modules/files/file.schema';
import { FileScanner, FileStorage } from '../src/modules/files/file-storage';
import type { FileHead } from '../src/modules/files/file.types';
import { startEnv, type TestEnv } from './helpers';

class MemoryFileStorage extends FileStorage {
  configured = true;
  readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();

  isConfigured() {
    return this.configured;
  }

  async createUploadUrl(input: { key: string; contentType: string }) {
    this.objects.set(input.key, {
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: input.contentType,
    });
    return `https://files.test/${encodeURIComponent(input.key)}`;
  }

  async head(key: string): Promise<FileHead> {
    const object = this.objects.get(key);
    if (!object) throw new Error('test object missing');
    return { sizeBytes: object.bytes.length, contentType: object.contentType };
  }

  async read(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error('test object missing');
    return object.bytes;
  }

  async createAccessUrl(key: string) {
    return `https://files.test/access/${encodeURIComponent(key)}`;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

class TestScanner extends FileScanner {
  result: 'CLEAN' | 'INFECTED' = 'CLEAN';

  async scan() {
    return this.result;
  }
}

let env: TestEnv;
let storage: MemoryFileStorage;
let scanner: TestScanner;
let assets: Model<FileAsset>;
const http = () => request(env.app.getHttpServer());
type Method = 'get' | 'post' | 'patch' | 'delete';
const call = (method: Method, path: string, userId?: string, body?: object) => {
  const req = http()[method](`/api/v1${path}`);
  if (userId) req.set('Authorization', `Bearer ${env.token(userId)}`);
  return body ? req.send(body) : req;
};

beforeAll(async () => {
  storage = new MemoryFileStorage();
  scanner = new TestScanner();
  env = await startEnv({
    overrides: [
      { provide: FileStorage, useValue: storage },
      { provide: FileScanner, useValue: scanner },
    ],
  });
  assets = env.app.get<Model<FileAsset>>(getModelToken(FileAsset.name));
});
afterAll(async () => {
  await env.close();
});
beforeEach(() => {
  storage.objects.clear();
  scanner.result = 'CLEAN';
});

const initAvatar = (userId: string, sizeBytes = 3) =>
  call('post', '/files/uploads', userId, {
    purpose: 'AVATAR',
    fileName: '..\\private\\avatar.jpg',
    contentType: 'image/jpeg',
    sizeBytes,
  });

describe('Uploads', () => {
  it('creates a short-lived URL, scans the uploaded bytes, and gates avatar use on READY', async () => {
    const owner = await env.createUser();
    const init = await initAvatar(owner).expect(201);
    expect(init.body.data).toMatchObject({
      purpose: 'AVATAR',
      fileName: '.._private_avatar.jpg',
      status: 'INITIATED',
      uploadUrl: expect.stringContaining('https://files.test/'),
      uploadHeaders: { 'Content-Type': 'image/jpeg' },
    });
    expect(init.body.data).not.toHaveProperty('storageKey');

    await call('patch', '/users/me/profile', owner, { avatarFileId: init.body.data.id }).expect(409);
    const ready = await call('post', `/files/uploads/${init.body.data.id}/complete`, owner).expect(200);
    expect(ready.body.data.status).toBe('READY');
    await call('patch', '/users/me/profile', owner, { avatarFileId: init.body.data.id }).expect(200);

    const ownerAccess = await call('get', `/files/${init.body.data.id}/access`, owner).expect(200);
    expect(ownerAccess.body.data).toMatchObject({
      url: expect.stringContaining('/access/'),
      previewSupported: true,
    });
    const other = await env.createUser();
    await call('get', `/files/${init.body.data.id}/access`, other).expect(403);
    const stored = await assets.findById(init.body.data.id).select('+storageKey').lean();
    expect(stored?.storageKey).toBeTruthy();
  });

  it('rejects unsupported purpose/type pairs, oversized images, and unconfigured storage', async () => {
    const owner = await env.createUser();
    await call('post', '/files/uploads', owner, {
      purpose: 'AVATAR',
      fileName: 'notes.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
    }).expect(422);
    await initAvatar(owner, 10_000_001).expect(422);

    storage.configured = false;
    await initAvatar(owner).expect(503);
    storage.configured = true;
    await call('post', '/files/uploads', undefined, {
      purpose: 'AVATAR',
      fileName: 'avatar.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 3,
    }).expect(401);
  });

  it('rejects content-type mismatches and malware without ever marking the file READY', async () => {
    const owner = await env.createUser();
    const wrongType = await call('post', '/files/uploads', owner, {
      purpose: 'DOCUMENT',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 3,
    }).expect(201);
    await call('post', `/files/uploads/${wrongType.body.data.id}/complete`, owner)
      .expect(409)
      .expect(res => expect(res.body.error.code).toBe('FILE_REJECTED'));
    expect((await call('get', `/files/uploads/${wrongType.body.data.id}`, owner)).body.data.status)
      .toBe('REJECTED');

    const upload = await initAvatar(owner).expect(201);
    scanner.result = 'INFECTED';
    await call('post', `/files/uploads/${upload.body.data.id}/complete`, owner)
      .expect(409)
      .expect(res => expect(res.body.error.code).toBe('FILE_REJECTED'));
    expect((await assets.findById(upload.body.data.id).lean())?.status).toBe('REJECTED');
  });

  it('does not disclose or delete another user’s upload', async () => {
    const owner = await env.createUser();
    const other = await env.createUser();
    const init = await initAvatar(owner).expect(201);
    await call('get', `/files/uploads/${init.body.data.id}`, other).expect(404);
    await call('delete', `/files/uploads/${init.body.data.id}`, other).expect(404);
    expect(storage.objects.size).toBe(1);
  });
});
