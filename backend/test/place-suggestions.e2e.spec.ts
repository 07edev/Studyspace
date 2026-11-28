import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { Role } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/audit-log.schema';
import { OutboxEvent } from '../src/modules/outbox/outbox-event.schema';
import { PlaceCategory, PlaceOrigin, PlaceStatus } from '../src/modules/places/place.enums';
import { PlaceFileRef } from '../src/modules/places/ports/place-file.port';
import { PlaceHistoryEntity } from '../src/modules/places/schemas/place-history.schema';
import { PlaceEntity } from '../src/modules/places/schemas/place.schema';
import { SuggestionType } from '../src/modules/place-suggestions/place-suggestion.schema';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let places: Model<PlaceEntity>;
let histories: Model<PlaceHistoryEntity>;
let audits: Model<AuditLog>;
let outbox: Model<OutboxEvent>;
let userId: string;
let adminId: string;
const http = () => request(env.app.getHttpServer());

beforeAll(async () => {
  env = await startEnv({
    overrides: [{ provide: PlaceFileRef, useValue: { assertReady: async () => undefined } }],
  });
  places = env.app.get(getModelToken(PlaceEntity.name));
  histories = env.app.get(getModelToken(PlaceHistoryEntity.name));
  audits = env.app.get(getModelToken(AuditLog.name));
  outbox = env.app.get(getModelToken(OutboxEvent.name));
  userId = await env.createUser();
  adminId = await env.createUser({
    role: Role.ADMIN,
    permissions: [
      { module: 'SUGGESTIONS', actions: ['READ', 'MODERATE'] },
      { module: 'STATISTICS', actions: ['READ'] },
      { module: 'USERS', actions: ['READ'] },
    ],
  });
});

afterAll(() => env.close());

describe('Place Suggestions & Approval E2E (P08 + P09 / S2)', () => {
  it('keeps PENDING suggestion out of places, approves once via CAS + Idempotency, writes history/audit/outbox', async () => {
    const createRes = await http()
      .post('/api/v1/place-suggestions')
      .set('Authorization', `Bearer ${env.token(userId)}`)
      .set('Idempotency-Key', 'suggest-create-key-001')
      .send({
        type: SuggestionType.CREATE,
        proposedPlace: {
          name: 'Góc Học Tập Sáng Tạo',
          category: PlaceCategory.STUDY_ROOM,
          address: { line1: '88 Nguyễn Huệ', provinceCode: '79', countryCode: 'VN' },
          location: { lat: 10.774, lng: 106.703 },
          origin: PlaceOrigin.USER_SUGGESTION,
          amenities: ['WIFI', 'POWER_OUTLET'],
        },
      })
      .expect(201);

    const suggestionId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('PENDING');
    expect(await places.countDocuments({ name: 'Góc Học Tập Sáng Tạo' })).toBe(0);

    // Dashboard shows pendingSuggestions = 1
    const dash = await http()
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .expect(200);
    expect(dash.body.data.pendingSuggestions).toBeGreaterThanOrEqual(1);

    // Wrong expectedVersion -> 409 VERSION_CONFLICT
    const stale = await http()
      .post(`/api/v1/admin/place-suggestions/${suggestionId}/decision`)
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .set('Idempotency-Key', 'decide-stale-key-001')
      .send({ action: 'APPROVE', expectedVersion: 99 })
      .expect(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');

    // Approve with correct expectedVersion + Idempotency-Key
    const approved = await http()
      .post(`/api/v1/admin/place-suggestions/${suggestionId}/decision`)
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .set('Idempotency-Key', 'decide-approve-key-001')
      .send({ action: 'APPROVE', expectedVersion: 1 })
      .expect(200);
    expect(approved.body.data.status).toBe('APPROVED');
    const createdPlaceId = approved.body.data.placeId;
    expect(createdPlaceId).toBeTruthy();

    // Replay with same Idempotency-Key does not create a second place
    await http()
      .post(`/api/v1/admin/place-suggestions/${suggestionId}/decision`)
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .set('Idempotency-Key', 'decide-approve-key-001')
      .send({ action: 'APPROVE', expectedVersion: 1 });
    expect(await places.countDocuments({ name: 'Góc Học Tập Sáng Tạo', status: PlaceStatus.PUBLISHED })).toBe(1);

    // Verify history, audit & outbox
    expect(await histories.countDocuments({ placeId: createdPlaceId })).toBe(1);
    expect(await audits.countDocuments({ action: 'SUGGESTION_APPROVED', resourceId: suggestionId })).toBe(1);
    const ev = await outbox.findOne({ eventType: 'SUGGESTION_DECIDED', aggregateId: suggestionId });
    expect(ev?.payload).toMatchObject({ recipientId: userId, action: 'APPROVE', placeId: createdPlaceId });
  });
});
