import request from 'supertest';
import { Role } from '../src/common/enums';
import { PlaceCategory, PlaceOrigin, PlaceStatus } from '../src/modules/places/place.enums';
import { PlaceFileRef } from '../src/modules/places/ports/place-file.port';
import { PlaceProvidersService } from '../src/modules/places/providers/place-providers.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
let creatorId: string;
const http = () => request(env.app.getHttpServer());

beforeAll(async () => {
  env = await startEnv({
    overrides: [{ provide: PlaceFileRef, useValue: { assertReady: async () => undefined } }],
  });
  creatorId = await env.createUser({
    role: Role.ADMIN,
    permissions: [{ module: 'PLACES', actions: ['READ', 'CREATE', 'UPDATE'] }],
  });
  const providers = env.app.get(PlaceProvidersService);
  providers.setFetcher(async url => {
    if (url.includes('nominatim')) {
      return new Response(
        JSON.stringify([
          {
            osm_type: 'node',
            osm_id: 555,
            name: 'The Study Hub',
            display_name: 'The Study Hub, Quận 1, TP.HCM',
            type: 'cafe',
            lat: '10.776',
            lon: '106.700',
          },
        ]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ search: [] }), { status: 200 });
  });
});

afterAll(() => env.close());

describe('External Place Search & Duplicate Detection (P04)', () => {
  it('searches OSM candidates, imports with signed candidateToken and detects duplicates', async () => {
    const search = await http()
      .get('/api/v1/admin/place-candidates/search?q=study&providers=OSM')
      .set('Authorization', `Bearer ${env.token(creatorId)}`)
      .expect(200);
    expect(search.body.data.items).toHaveLength(1);
    const candidate = search.body.data.items[0];

    const created = await http()
      .post('/api/v1/admin/places')
      .set('Authorization', `Bearer ${env.token(creatorId)}`)
      .send({
        name: candidate.name,
        category: PlaceCategory.CAFE,
        address: { line1: '10 Đồng Khởi', provinceCode: '79', countryCode: 'VN' },
        location: candidate.location,
        origin: PlaceOrigin.OSM,
        importCandidateToken: candidate.candidateToken,
        status: PlaceStatus.PUBLISHED,
      })
      .expect(201);
    expect(created.body.data.sources[0]).toMatchObject({
      provider: PlaceOrigin.OSM,
      providerPlaceId: 'node/555',
    });

    // Duplicate check returns high-confidence match
    const dup = await http()
      .post('/api/v1/admin/places/duplicate-check')
      .set('Authorization', `Bearer ${env.token(creatorId)}`)
      .send({ name: 'The Study Hub', location: { lat: 10.7761, lng: 106.7001 } })
      .expect(200);
    expect(dup.body.data.requiresReview).toBe(true);
    expect(dup.body.data.possibleDuplicates.length).toBeGreaterThanOrEqual(1);

    // Creating duplicate without duplicateOverrideReason -> 409 DUPLICATE_SUSPECTED
    const blocked = await http()
      .post('/api/v1/admin/places')
      .set('Authorization', `Bearer ${env.token(creatorId)}`)
      .send({
        name: 'The Study Hub',
        category: PlaceCategory.CAFE,
        address: { line1: '10 Đồng Khởi', provinceCode: '79', countryCode: 'VN' },
        location: { lat: 10.7761, lng: 106.7001 },
        origin: PlaceOrigin.MANUAL,
      })
      .expect(409);
    expect(blocked.body.error.code).toBe('DUPLICATE_SUSPECTED');
  });
});
