import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { Role } from '../src/common/enums';
import {
  AttributeType,
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../src/modules/places/place.enums';
import { PlaceEntity } from '../src/modules/places/schemas/place.schema';
import { TaxonomyService } from '../src/modules/taxonomy/taxonomy.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let placesModel: Model<PlaceEntity>;
let adminId: string;
const http = () => request(env.app.getHttpServer());

beforeAll(async () => {
  env = await startEnv();
  await env.app.get(TaxonomyService).seedEntries();
  placesModel = env.app.get<Model<PlaceEntity>>(getModelToken(PlaceEntity.name));
  adminId = await env.createUser({
    role: Role.ADMIN,
    permissions: [{ module: 'PLACES', actions: ['READ', 'UPDATE'] }],
  });
});

afterAll(() => env.close());

describe('Place Attributes & Public Places APIs (P05 + P02)', () => {
  let attrId: string;
  let pubPlaceId: string;

  it('creates & lists attribute definitions and blocks changing key/type when in use', async () => {
    const created = await http()
      .post('/api/v1/admin/place-attributes')
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .send({
        key: 'wifi-quality',
        label: 'Chất lượng Wi-Fi',
        type: AttributeType.SINGLE_SELECT,
        options: ['Tốt', 'Xuất sắc'],
        required: false,
        filterable: true,
        active: true,
      })
      .expect(201);
    attrId = created.body.data.id;

    const pubAttrs = await http()
      .get('/api/v1/places/attribute-definitions?filterable=true')
      .expect(200);
    expect(pubAttrs.body.data.items.some((a: { id: string }) => a.id === attrId)).toBe(true);

    const place = await placesModel.create({
      name: 'Quán Học Tập Bách Khoa',
      nameNormalized: 'quan hoc tap bach khoa',
      category: PlaceCategory.CAFE,
      address: { line1: '268 Lý Thường Kiệt', provinceCode: '79', countryCode: 'VN' },
      location: { type: 'Point', coordinates: [106.659, 10.772] },
      amenities: ['WIFI', 'POWER_OUTLET'],
      quietLevel: QuietLevel.QUIET,
      studySuitability: StudySuitability.BOTH,
      attributes: [{ definitionId: attrId, value: 'Xuất sắc' }],
      sources: [{ provider: PlaceOrigin.OSM, providerPlaceId: 'osm-1' }],
      fieldStates: [{ path: 'name', verified: FieldVerifiedStatus.VERIFIED, locked: true }],
      origin: PlaceOrigin.MANUAL,
      status: PlaceStatus.PUBLISHED,
      ratingAverage: 4.8,
      ratingCount: 12,
      reviewCount: 12,
    });
    pubPlaceId = String(place._id);

    // Changing type while in use -> 409 ATTRIBUTE_IN_USE
    const conflict = await http()
      .patch(`/api/v1/admin/place-attributes/${attrId}`)
      .set('Authorization', `Bearer ${env.token(adminId)}`)
      .send({ type: AttributeType.TEXT })
      .expect(409);
    expect(conflict.body.error.code).toBe('ATTRIBUTE_IN_USE');
  });

  it('returns redacted public places, supports geo/map/facets/home/similar and rejects huge bbox', async () => {
    const home = await http().get('/api/v1/home?lat=10.772&lng=106.659').expect(200);
    expect(home.body.data.nearby.length).toBeGreaterThanOrEqual(1);

    const detail = await http().get(`/api/v1/places/${pubPlaceId}`).expect(200);
    expect(detail.body.data.location).toEqual({ lat: 10.772, lng: 106.659 });
    expect(detail.body.data).not.toHaveProperty('sources');
    expect(detail.body.data).not.toHaveProperty('fieldStates');

    const mapOk = await http()
      .get('/api/v1/places/map?bbox=106.6,10.7,106.8,10.85')
      .expect(200);
    expect(mapOk.body.data.items.some((p: { placeId: string }) => p.placeId === pubPlaceId)).toBe(true);

    const mapTooLarge = await http()
      .get('/api/v1/places/map?bbox=100,8,109,16')
      .expect(400);
    expect(mapTooLarge.body.error.code).toBe('MAP_BOUNDS_TOO_LARGE');

    const facets = await http().get('/api/v1/places/facets').expect(200);
    expect(facets.body.data.categories.length).toBeGreaterThanOrEqual(1);
    expect(facets.body.data.customAttributes.some((a: { id: string }) => a.id === attrId)).toBe(true);

    const similar = await http().get(`/api/v1/places/${pubPlaceId}/similar`).expect(200);
    expect(similar.body.data.items.every((p: { id: string }) => p.id !== pubPlaceId)).toBe(true);
  });
});
