import request from 'supertest';
import mongoose from 'mongoose';
import { AccountStatus, Role } from '../src/common/enums';
import { StatsRegistry } from '../src/modules/stats/stats.registry';
import { startEnv, type TestEnv } from './helpers';

let env: TestEnv;
const http = () => request(env.app.getHttpServer());
const call = (path: string, userId?: string) => {
  const r = http().get(`/api/v1${path}`);
  if (userId) r.set('Authorization', `Bearer ${env.token(userId)}`);
  return r;
};
let reader: string; // ADMIN with STATISTICS.READ

// Users created at a known instant (the schema stamps createdAt itself).
async function userAt(iso: string, extra: { status?: AccountStatus; role?: Role } = {}) {
  const id = await env.createUser({ status: extra.status, role: extra.role });
  await env.users.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { createdAt: new Date(iso) } });
  return id;
}

beforeAll(async () => {
  env = await startEnv();
  reader = await env.createUser({ role: Role.ADMIN, permissions: [{ module: 'STATISTICS', actions: ['READ'] }] });
});
afterAll(() => env.close());

const RANGE = 'from=2026-03-01&to=2026-03-14'; // Sunday 1 Mar .. Saturday 14 Mar 2026

describe('access control', () => {
  it('needs STATISTICS.READ on every statistics endpoint', async () => {
    const plain = await env.createUser();
    const other = await env.createUser({ role: Role.ADMIN, permissions: [{ module: 'USERS', actions: ['READ'] }] });
    for (const path of ['/admin/dashboard', '/admin/statistics/overview', '/admin/statistics/activity']) {
      await call(path).expect(401);
      await call(path, plain).expect(403);
      await call(path, other).expect(403);
      await call(path, reader).expect(200);
    }
  });
});

describe('before any other team is connected', () => {
  it('shows what TV1 owns and leaves the rest out instead of reporting zeros', async () => {
    const res = await call('/admin/dashboard', reader).expect(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['newUsers', 'range', 'totalUsers']);
    const activity = await call('/admin/statistics/activity', reader).expect(200);
    expect(activity.body.data.series).toEqual(['users']);
    expect(activity.body.data.items[0]).not.toHaveProperty('places');
  });
});

describe('users numbers', () => {
  it('counts only accounts with role USER that are not deleted', async () => {
    const before = (await call('/admin/dashboard', reader)).body.data;
    await userAt(new Date().toISOString());
    await userAt(new Date().toISOString(), { status: AccountStatus.SUSPENDED }); // suspended still counts
    await userAt(new Date().toISOString(), { status: AccountStatus.DELETED }); // deleted does not
    await userAt(new Date().toISOString(), { role: Role.ADMIN }); // staff does not
    const after = (await call('/admin/dashboard', reader)).body.data;
    expect(after.totalUsers - before.totalUsers).toBe(2);
    expect(after.newUsers - before.newUsers).toBe(2);
  });

  it('"new users" follows the number of days asked for, and bad values are refused', async () => {
    const old = await userAt(new Date(Date.now() - 10 * 86_400_000).toISOString());
    const week = (await call('/admin/dashboard?days=7', reader)).body.data;
    const month = (await call('/admin/dashboard?days=30', reader)).body.data;
    expect(month.newUsers - week.newUsers).toBeGreaterThanOrEqual(1);
    expect(old).toBeTruthy();
    expect(week.range.to).toBe(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)); // today, Vietnam time
    for (const days of ['0', '91', 'x', '1.5']) await call(`/admin/dashboard?days=${days}`, reader).expect(422);
  });
});

describe('GET /admin/statistics/activity', () => {
  beforeAll(async () => {
    await userAt('2026-03-01T16:30:00Z'); // 23:30 on 1 Mar in Vietnam
    await userAt('2026-03-01T17:30:00Z'); // 00:30 on 2 Mar in Vietnam: same UTC day, different Vietnamese day
    await userAt('2026-03-05T05:00:00Z');
    await userAt('2026-03-10T05:00:00Z');
    await userAt('2026-02-20T05:00:00Z'); // before the range
    await userAt('2026-03-06T05:00:00Z', { status: AccountStatus.DELETED }); // deleted: not counted
    await userAt('2026-03-07T05:00:00Z', { role: Role.ADMIN }); // staff: not counted
  });

  it('gives one point per day, zero where nothing happened, cut at Vietnam midnight', async () => {
    const res = await call(`/admin/statistics/activity?${RANGE}`, reader).expect(200);
    const { items, pagination, granularity, range, series } = res.body.data;
    expect({ granularity, range, series }).toEqual({ granularity: 'DAY', range: { from: '2026-03-01', to: '2026-03-14' }, series: ['users'] });
    expect(items).toHaveLength(14);
    expect(pagination).toMatchObject({ page: 1, total: 14, hasNext: false });
    const counts = Object.fromEntries(items.map((p: { date: string; users: number }) => [p.date, p.users]));
    expect(counts['2026-03-01']).toBe(1);
    expect(counts['2026-03-02']).toBe(1);
    expect(counts['2026-03-05']).toBe(1);
    expect(counts['2026-03-10']).toBe(1);
    expect(Object.values(counts).reduce((a: number, b) => a + (b as number), 0)).toBe(4);
    expect(items.map((p: { date: string }) => p.date)).toEqual([...items.map((p: { date: string }) => p.date)].sort());
  });

  it('rolls up to weeks (Monday start) and months without losing anyone', async () => {
    const weeks = (await call(`/admin/statistics/activity?${RANGE}&granularity=week`, reader).expect(200)).body.data;
    expect(weeks.items).toEqual([
      { date: '2026-02-23', users: 1 }, // Sunday 1 Mar belongs to the week of Monday 23 Feb
      { date: '2026-03-02', users: 2 },
      { date: '2026-03-09', users: 1 },
    ]);
    const months = (await call(`/admin/statistics/activity?${RANGE}&granularity=MONTH`, reader).expect(200)).body.data;
    expect(months.items).toEqual([{ date: '2026-03-01', users: 4 }]);
  });

  it('refuses bad ranges and parameters with 422', async () => {
    const bad = [
      'from=2026-03-10&to=2026-03-01', // reversed
      'from=2026-02-30&to=2026-03-01', // not a real day
      'from=03/01/2026',
      'from=2025-01-01&to=2026-03-14', // longer than 366 days
      `${RANGE}&granularity=HOUR`,
      `${RANGE}&module=money`,
    ];
    for (const qs of bad) {
      const res = await call(`/admin/statistics/activity?${qs}`, reader).expect(422);
      expect(['QUERY_INVALID', 'VALIDATION_ERROR']).toContain(res.body.error.code);
    }
  });
});

describe('GET /admin/statistics/overview', () => {
  it('counts new users inside the asked range and can be narrowed to some metrics', async () => {
    const all = (await call(`/admin/statistics/overview?${RANGE}`, reader).expect(200)).body.data;
    expect(all.newUsers).toBe(4);
    expect(all.range).toEqual({ from: '2026-03-01', to: '2026-03-14' });
    const only = (await call(`/admin/statistics/overview?${RANGE}&metrics=newUsers`, reader).expect(200)).body.data;
    expect(Object.keys(only).sort()).toEqual(['newUsers', 'range']);
    for (const metrics of ['bogus', 'newUsers,bogus', ',']) {
      const res = await call(`/admin/statistics/overview?${RANGE}&metrics=${metrics}`, reader).expect(422);
      expect(res.body.error.code).toBe('QUERY_INVALID');
    }
  });
});

describe('numbers from other teams (StatsRegistry)', () => {
  beforeAll(() => {
    const registry = env.app.get(StatsRegistry);
    registry.register({
      name: 'places',
      overview: async () => ({ totalPlaces: 12, pendingSuggestions: 3, placesByCategory: { cafe: 7, library: 5 }, openReports: -1, totalPosts: 1.5 } as never),
      daily: async () => ({ places: [{ date: '2026-03-02', count: 2 }, { date: '2026-03-02', count: 1 }, { date: 'bad', count: 9 }, { date: '2026-03-03', count: -4 }] }),
    });
    registry.register({
      name: 'content',
      overview: async () => ({ totalPosts: 40, totalDocuments: 9, pendingDocuments: 2, openReports: 6, hacker: 1 } as never),
      daily: async () => ({ posts: [{ date: '2026-03-05', count: 4 }], documents: [{ date: '2026-03-05', count: 1 }], reports: [] }),
    });
    registry.register({
      name: 'broken',
      overview: async () => {
        throw new Error('database down');
      },
      daily: async () => {
        throw new Error('database down');
      },
    });
  });

  it('merges every source, keeps only valid counts and names a source that failed', async () => {
    const res = (await call(`/admin/statistics/overview?${RANGE}`, reader).expect(200)).body.data;
    expect(res).toMatchObject({
      totalPlaces: 12, pendingSuggestions: 3, placesByCategory: { cafe: 7, library: 5 },
      totalPosts: 40, totalDocuments: 9, pendingDocuments: 2, openReports: 6,
      failedSources: ['broken'],
    });
    expect(res).not.toHaveProperty('hacker'); // unknown field dropped
    const dash = (await call('/admin/dashboard', reader).expect(200)).body.data;
    expect(dash.totalPlaces).toBe(12);
  });

  it('shows the series other teams provide, summing days, ignoring invalid rows', async () => {
    const res = (await call(`/admin/statistics/activity?${RANGE}`, reader).expect(200)).body.data;
    expect(res.series.sort()).toEqual(['documents', 'places', 'posts', 'reports', 'users']);
    const byDate = Object.fromEntries(res.items.map((p: Record<string, number | string>) => [p.date, p]));
    expect(byDate['2026-03-02']).toMatchObject({ places: 3, posts: 0, users: 1 }); // 2 + 1 summed
    expect(byDate['2026-03-03'].places).toBe(0); // negative ignored
    expect(byDate['2026-03-05']).toMatchObject({ posts: 4, documents: 1, reports: 0, users: 1 });
    expect(res.failedSources).toEqual(['broken']);
  });

  it('can be narrowed to one series with module', async () => {
    const res = (await call(`/admin/statistics/activity?${RANGE}&module=places`, reader).expect(200)).body.data;
    expect(res.series).toEqual(['places']);
    expect(res.items[0]).toEqual({ date: '2026-03-01', places: 0 });
    const weeks = (await call(`/admin/statistics/activity?${RANGE}&module=places&granularity=WEEK`, reader).expect(200)).body.data;
    expect(weeks.items.reduce((sum: number, p: { places: number }) => sum + p.places, 0)).toBe(3);
  });
});
