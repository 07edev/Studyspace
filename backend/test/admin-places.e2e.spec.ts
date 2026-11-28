import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import {
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
} from '../src/modules/places/place.enums';
import { PlaceFileRef } from '../src/modules/places/ports/place-file.port';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let auditModel: Model<AuditLog>;
let editorId: string;
let statsReaderId: string;
const http = () => request(env.app.getHttpServer());

const samplePlace = {
  name: 'Thư viện Khoa học Tự nhiên',
  category: PlaceCategory.LIBRARY,
  address: { line1: '227 Nguyễn Văn Cừ', provinceCode: '79', countryCode: 'VN' },
  location: { lat: 10.7629, lng: 106.6822 },
  origin: PlaceOrigin.MANUAL,
  status: PlaceStatus.PUBLISHED,
  amenities: ['WIFI', 'QUIET_ZONE'],
};

beforeAll(async () => {
  env = await startEnv({
    overrides: [{ provide: PlaceFileRef, useValue: { assertReady: async () => undefined } }],
  });
  auditModel = env.app.get<Model<AuditLog>>(getModelToken(AuditLog.name));
  editorId = await env.createUser({
    role: Role.ADMIN,
    permissions: [{ module: 'PLACES', actions: ['READ', 'CREATE', 'UPDATE'] }],
  });
  statsReaderId = await env.createUser({
    role: Role.ADMIN,
    permissions: [{ module: 'STATISTICS', actions: ['READ'] }],
  });
});

afterAll(() => env.close());

describe('Admin Places CRUD, CAS, Field Locks, History, Audit & Stats (P03)', () => {
  let placeId: string;

  it('creates a place, records history & audit, and feeds dashboard stats', async () => {
    const created = await http()
      .post('/api/v1/admin/places')
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send(samplePlace)
      .expect(201);
    placeId = created.body.data.id;
    expect(created.body.data.version).toBe(1);

    const dash = await http()
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${env.token(statsReaderId)}`)
      .expect(200);
    expect(dash.body.data.totalPlaces).toBeGreaterThanOrEqual(1);
    expect(dash.body.data.placesByCategory.LIBRARY).toBeGreaterThanOrEqual(1);

    const logs = await auditModel.countDocuments({ action: 'PLACE_CREATED', resourceId: placeId });
    expect(logs).toBe(1);
  });

  it('enforces optimistic concurrency (version CAS) and field locking', async () => {
    const okPatch = await http()
      .patch(`/api/v1/admin/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({ name: 'Thư viện KHTN Cơ sở 1', version: 1 })
      .expect(200);
    expect(okPatch.body.data.version).toBe(2);

    // Stale version -> 409 VERSION_CONFLICT
    const stale = await http()
      .patch(`/api/v1/admin/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({ name: 'Trùng phiên bản', version: 1 })
      .expect(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');

    // Lock field `name` -> 409 FIELD_LOCKED on next edit
    await http()
      .patch(`/api/v1/admin/places/${placeId}/fields/state`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({
        path: 'name',
        action: 'LOCK',
        verified: FieldVerifiedStatus.VERIFIED,
        reason: 'Đã xác minh tên chính thức',
      })
      .expect(200);

    const locked = await http()
      .patch(`/api/v1/admin/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({ name: 'Sửa trái phép', version: 3 })
      .expect(409);
    expect(locked.body.error.code).toBe('FIELD_LOCKED');

    const hist = await http()
      .get(`/api/v1/admin/places/${placeId}/history`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .expect(200);
    expect(hist.body.data.items.length).toBeGreaterThanOrEqual(3);
  });

  it('soft deletes via status patch and blocks further edits', async () => {
    await http()
      .patch(`/api/v1/admin/places/${placeId}/status`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({ status: PlaceStatus.DELETED, reason: 'Địa điểm đã đóng cửa vĩnh viễn' })
      .expect(200);

    await http()
      .patch(`/api/v1/admin/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(editorId)}`)
      .send({ description: 'Không được sửa', version: 4 })
      .expect(409);
  });
});
