import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { Role } from '../src/common/enums';
import { PlaceCategory, PlaceOrigin, PlaceStatus } from '../src/modules/places/place.enums';
import { PlaceFileRef } from '../src/modules/places/ports/place-file.port';
import { PlaceEntity } from '../src/modules/places/schemas/place.schema';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let placeId: string;
let userA: string;
let userB: string;
let modAdmin: string;
const http = () => request(env.app.getHttpServer());

beforeAll(async () => {
  env = await startEnv({
    overrides: [{ provide: PlaceFileRef, useValue: { assertReady: async () => undefined } }],
  });
  const places = env.app.get<Model<PlaceEntity>>(getModelToken(PlaceEntity.name));
  const place = await places.create({
    name: 'Quán Yên Tĩnh Quận 3',
    nameNormalized: 'quan yen tinh quan 3',
    category: PlaceCategory.CAFE,
    address: { line1: '45 Võ Văn Tần', provinceCode: '79', countryCode: 'VN' },
    location: { type: 'Point', coordinates: [106.69, 10.775] },
    origin: PlaceOrigin.MANUAL,
    status: PlaceStatus.PUBLISHED,
  });
  placeId = String(place._id);
  userA = await env.createUser();
  userB = await env.createUser();
  modAdmin = await env.createUser({
    role: Role.ADMIN,
    permissions: [
      { module: 'REVIEWS', actions: ['READ', 'MODERATE'] },
      { module: 'USERS', actions: ['READ'] },
    ],
  });
});

afterAll(() => env.close());

describe('Favorites & Reviews E2E (P06 + P07)', () => {
  it('supports idempotent PUT/DELETE favorites and attaches isFavorite on GET /places/:id', async () => {
    await http()
      .put(`/api/v1/users/me/favorites/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(200);
    await http()
      .put(`/api/v1/users/me/favorites/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(200);

    const detail = await http()
      .get(`/api/v1/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(200);
    expect(detail.body.data.isFavorite).toBe(true);

    const list = await http()
      .get('/api/v1/users/me/favorites/places')
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(200);
    expect(list.body.data.items.map((p: { id: string }) => p.id)).toEqual([placeId]);

    await http()
      .delete(`/api/v1/users/me/favorites/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(204);
    await http()
      .delete(`/api/v1/users/me/favorites/places/${placeId}`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .expect(204);
  });

  it('enforces one active review per user, owner checks, aggregate rating & admin moderation', async () => {
    const rA = await http()
      .post(`/api/v1/places/${placeId}/reviews`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .send({ rating: 5, content: 'Không gian học rất tốt' })
      .expect(201);
    const reviewId = rA.body.data.id;

    // Duplicate active review -> 409 REVIEW_ALREADY_EXISTS
    const dup = await http()
      .post(`/api/v1/places/${placeId}/reviews`)
      .set('Authorization', `Bearer ${env.token(userA)}`)
      .send({ rating: 4 })
      .expect(409);
    expect(dup.body.error.code).toBe('REVIEW_ALREADY_EXISTS');

    // Another user cannot patch userA's review
    await http()
      .patch(`/api/v1/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${env.token(userB)}`)
      .send({ rating: 1 })
      .expect(403);

    // User B posts rating 3 -> average becomes 4
    await http()
      .post(`/api/v1/places/${placeId}/reviews`)
      .set('Authorization', `Bearer ${env.token(userB)}`)
      .send({ rating: 3, content: 'Hơi đông buổi tối' })
      .expect(201);

    let place = (await http().get(`/api/v1/places/${placeId}`).expect(200)).body.data;
    expect(place.ratingAverage).toBe(4);
    expect(place.ratingCount).toBe(2);

    // Admin hides userA's review -> average drops to 3, count 1
    await http()
      .patch(`/api/v1/admin/reviews/${reviewId}/moderation`)
      .set('Authorization', `Bearer ${env.token(modAdmin)}`)
      .send({ action: 'HIDE', reason: 'Nội dung vi phạm quy định cộng đồng' })
      .expect(200);

    place = (await http().get(`/api/v1/places/${placeId}`).expect(200)).body.data;
    expect(place.ratingAverage).toBe(3);
    expect(place.ratingCount).toBe(1);

    // AdminUsers detail shows reviewCount via UserContentRegistry
    const userDetail = await http()
      .get(`/api/v1/admin/users/${userA}`)
      .set('Authorization', `Bearer ${env.token(modAdmin)}`)
      .expect(200);
    expect(userDetail.body.data.reviewCount).toBe(1);
    const userReviews = await http()
      .get(`/api/v1/admin/users/${userA}/reviews`)
      .set('Authorization', `Bearer ${env.token(modAdmin)}`)
      .expect(200);
    expect(userReviews.body.data.items).toHaveLength(1);
  });
});
