import { describe, expect, it } from 'vitest';
import { UserContentRegistry } from '../src/modules/admin-users/ports';
import { FavoriteLookupRegistry } from '../src/modules/places/ports/favorite-lookup.port';
import { computeRatingSummary } from '../src/modules/reviews/reviews.service';

describe('computeRatingSummary', () => {
  it('computes rounded average and count accurately, returning 0 for empty sets', () => {
    expect(computeRatingSummary([])).toEqual({ ratingAverage: 0, ratingCount: 0 });
    expect(computeRatingSummary([5, 4, 4])).toEqual({ ratingAverage: 4.33, ratingCount: 3 });
    expect(computeRatingSummary([5])).toEqual({ ratingAverage: 5, ratingCount: 1 });
  });
});

describe('UserContentRegistry', () => {
  it('routes registered ContentKinds cleanly and returns undefined for unconnected ones', async () => {
    const registry = new UserContentRegistry();
    registry.register('reviews', {
      count: async () => 4,
      list: async (_uid, paging) => ({
        items: [{ id: 'r1' }],
        pagination: { ...paging, total: 1, totalPages: 1, hasNext: false },
      }),
    });

    expect(await registry.count('reviews', 'u1')).toBe(4);
    expect(await registry.count('posts', 'u1')).toBeUndefined();
    expect(await registry.list('reviews', 'u1', { page: 1, limit: 10 })).toMatchObject({
      items: [{ id: 'r1' }],
    });
    expect(await registry.list('documents', 'u1', { page: 1, limit: 10 })).toBeUndefined();
  });
});

describe('FavoriteLookupRegistry', () => {
  it('returns empty set when unregistered or guest, and delegates when registered', async () => {
    const reg = new FavoriteLookupRegistry();
    expect(await reg.lookup('u1', ['p1'])).toEqual(new Set());
    reg.register(async (_u, ids) => new Set(ids.filter(id => id === 'p1')));
    expect(await reg.lookup(undefined, ['p1'])).toEqual(new Set());
    expect(await reg.lookup('u1', ['p1', 'p2'])).toEqual(new Set(['p1']));
  });
});
