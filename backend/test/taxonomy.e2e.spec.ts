import request from 'supertest';
import { TaxonomyService } from '../src/modules/taxonomy/taxonomy.service';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
const http = () => request(env.app.getHttpServer());

beforeAll(async () => {
  env = await startEnv();
  await env.app.get(TaxonomyService).seedEntries();
});

afterAll(() => env.close());

describe('Taxonomy & Locations public endpoints (P01)', () => {
  it('returns seeded place-categories, amenities, provinces and wards', async () => {
    const cats = await http().get('/api/v1/taxonomies/place-categories').expect(200);
    expect(cats.body.data.items.map((i: { code: string }) => i.code)).toContain('CAFE');

    const amenities = await http().get('/api/v1/taxonomies/amenities').expect(200);
    expect(amenities.body.data.items.map((i: { code: string }) => i.code)).toContain('WIFI');

    const provinces = await http().get('/api/v1/locations/provinces').expect(200);
    expect(provinces.body.data.items.map((i: { code: string }) => i.code)).toContain('79');

    const wards = await http().get('/api/v1/locations/wards?provinceCode=79').expect(200);
    expect(wards.body.data.items.length).toBeGreaterThan(0);
    expect(wards.body.data.items.every((w: { code: string }) => w.code.startsWith('79-'))).toBe(true);
  });

  it('searches universities accent-insensitively and filters majors by universityId', async () => {
    const unis = await http().get('/api/v1/taxonomies/universities?q=bach khoa').expect(200);
    expect(unis.body.data.items.length).toBeGreaterThanOrEqual(1);
    const uniId = unis.body.data.items[0].id;

    const majors = await http().get(`/api/v1/taxonomies/majors?universityId=${uniId}`).expect(200);
    expect(majors.body.data.items.length).toBeGreaterThan(0);
    expect(majors.body.data.items.every((m: { parentId: string }) => m.parentId === uniId)).toBe(true);

    await http().get('/api/v1/taxonomies/majors?universityId=bad-id').expect(422);
  });

  it('keeps static ObjectIds stable on re-seed', async () => {
    const before = (await http().get('/api/v1/taxonomies/universities')).body.data.items;
    await env.app.get(TaxonomyService).seedEntries();
    const after = (await http().get('/api/v1/taxonomies/universities')).body.data.items;
    expect(after).toEqual(before);
  });

  it('validates user profile university/major/subjects through connected TaxonomyRef', async () => {
    const userId = await env.createUser();
    const unis = (await http().get('/api/v1/taxonomies/universities')).body.data.items;
    const hcmus = unis.find((u: { code: string }) => u.code === 'HCMUS');
    const ueh = unis.find((u: { code: string }) => u.code === 'UEH');
    const hcmusMajors = (await http().get(`/api/v1/taxonomies/majors?universityId=${hcmus.id}`)).body.data.items;
    const subjects = (await http().get('/api/v1/taxonomies/subjects')).body.data.items;

    const okRes = await http()
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${env.token(userId)}`)
      .send({
        universityId: hcmus.id,
        majorId: hcmusMajors[0].id,
        subjectIds: [subjects[0].id],
      })
      .expect(200);
    expect(okRes.body.data.profile.universityId).toBe(hcmus.id);

    const mismatch = await http()
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${env.token(userId)}`)
      .send({ universityId: ueh.id, majorId: hcmusMajors[0].id })
      .expect(422);
    expect(mismatch.body.error.code).toBe('UNIVERSITY_MAJOR_MISMATCH');
  });
});
