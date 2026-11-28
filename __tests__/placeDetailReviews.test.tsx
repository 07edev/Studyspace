/**
 * @format
 */

import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import StudySpaceApp from '../src/app/StudySpaceApp';
import { createApiClient } from '../src/shared/api/client';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import type { Place, Review } from '../src/shared/contracts/places';
import { Button } from '../src/shared/ui/Button';

const ok = (data: unknown, status = 200) =>
  ({
    status,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'req-1' }),
    headers: { get: () => null },
  } as unknown as Response);

const noContent = () =>
  ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response);

const fail = (status: number, code: string, message: string) =>
  ({
    status,
    ok: false,
    json: async () => ({ success: false, error: { code, message }, requestId: 'req-err' }),
    headers: { get: () => null },
  } as unknown as Response);

const page = <T,>(items: T[]) => ({
  items,
  pagination: { page: 1, limit: 20, total: items.length, totalPages: 1, hasNext: false },
});

const user = {
  id: 'u1',
  email: 'an@example.test',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

const samplePlace: Place = {
  id: '65f000000000000000000011',
  name: 'The Study Loft',
  category: 'CAFE',
  address: { line1: '88 Đồng Khởi', provinceCode: '79', countryCode: 'VN', displayText: '88 Đồng Khởi, Q1' },
  location: { lat: 10.7769, lng: 106.7009 },
  images: [],
  hours: [],
  amenities: ['WIFI'],
  quietLevel: 'QUIET',
  studySuitability: 'BOTH',
  origin: 'MANUAL',
  status: 'PUBLISHED',
  ratingAverage: 4.5,
  ratingCount: 1,
  isFavorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
};

const sampleReview: Review = {
  id: '65f000000000000000000071',
  placeId: samplePlace.id,
  placeName: samplePlace.name,
  author: { id: user.id, displayName: 'An' },
  rating: 5,
  content: 'Quán rất yên tĩnh và mát mẻ.',
  status: 'PUBLISHED',
  createdAt: '2026-02-01T08:00:00.000Z',
};

type Call = { method: string; path: string; body?: unknown };

function makeSession(matcher: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetcher = jest.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.replace('https://api.test', ''),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (call.path === '/auth/token/refresh') {
      return ok({ accessToken: 'a1', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'r2' });
    }
    if (call.path === '/auth/me' || call.path === '/users/me') {
      return ok(user);
    }
    const res = matcher(call);
    if (!res) {
      throw new Error(`unexpected request ${call.method} ${call.path}`);
    }
    return res;
  });
  const session = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    createMemoryTokenStorage('refresh-1'),
  );
  return { session, calls };
}

let tree: ReactTestRenderer.ReactTestRenderer;
const act = ReactTestRenderer.act;
const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
};
const textOf = (node: ReactTestRenderer.ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map(t => [t.props.children].flat().join(''))
    .join(' ');
const everything = () => textOf(tree.root);
const pressButton = async (title: string) => {
  const matches = tree.root.findAllByType(Button).filter(b => b.props.title === title);
  const target = matches[matches.length - 1];
  if (!target) {
    throw new Error(`no button "${title}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const pressByLabel = async (label: string) => {
  const matches = tree.root.findAll(
    n => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label,
  );
  const target = matches[matches.length - 1];
  if (!target) {
    throw new Error(`no pressable "${label}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const type = async (label: string, value: string) => {
  const input = tree.root.findAllByType(TextInput).find(i => i.props.accessibilityLabel === label);
  if (!input) {
    throw new Error(`no input "${label}"`);
  }
  await act(async () => {
    input.props.onChangeText(value);
  });
};

afterEach(async () => {
  await act(async () => tree.unmount());
});

describe('Mobile Favorites & Reviews (M10: U13, U15-U18)', () => {
  test('optimistically toggles favorite on U13 and rolls back on failure', async () => {
    let failNext = true;
    const { session, calls } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [samplePlace], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path === `/places/${samplePlace.id}`) {
        return ok(samplePlace);
      }
      if (call.path === `/places/${samplePlace.id}/similar`) {
        return ok(page([]));
      }
      if (call.method === 'PUT' && call.path === `/users/me/favorites/places/${samplePlace.id}`) {
        if (failNext) {
          failNext = false;
          return fail(500, 'INTERNAL_ERROR', 'Lỗi mạng.');
        }
        return ok({ value: true });
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    await flush();
    await pressByLabel(`Xem địa điểm ${samplePlace.name}`);
    await flush();

    // 1st tap fails -> rolls back to 'Yêu thích'
    await pressButton('Yêu thích');
    await flush();
    expect(everything()).toContain('Chưa cập nhật được trạng thái yêu thích');
    expect(tree.root.findAllByType(Button).some(b => b.props.title === 'Yêu thích')).toBe(true);

    // 2nd tap succeeds -> shows 'Đã yêu thích'
    await pressButton('Yêu thích');
    await flush();
    expect(calls.filter(c => c.method === 'PUT')).toHaveLength(2);
    expect(tree.root.findAllByType(Button).some(b => b.props.title === 'Đã yêu thích')).toBe(true);
  });

  test('lists reviews (U15), creates a review (U16), and deletes own review via confirm (U17)', async () => {
    let reviewsList: Review[] = [];
    const { session, calls } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [samplePlace], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path === `/places/${samplePlace.id}`) {
        return ok(samplePlace);
      }
      if (call.path === `/places/${samplePlace.id}/similar`) {
        return ok(page([]));
      }
      if (call.method === 'GET' && call.path.startsWith(`/places/${samplePlace.id}/reviews`)) {
        return ok(page(reviewsList));
      }
      if (call.method === 'POST' && call.path === `/places/${samplePlace.id}/reviews`) {
        reviewsList = [sampleReview];
        return ok(sampleReview, 201);
      }
      if (call.method === 'DELETE' && call.path === `/reviews/${sampleReview.id}`) {
        reviewsList = [];
        return noContent();
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    await flush();
    await pressByLabel(`Xem địa điểm ${samplePlace.name}`);
    await flush();

    await pressButton('Xem đánh giá (1)');
    await flush();
    await pressButton('Viết đánh giá');
    await pressByLabel('5 sao');
    await type('Chia sẻ trải nghiệm học tập', 'Quán rất yên tĩnh và mát mẻ.');
    await pressButton('Gửi đánh giá');
    await flush();

    expect(calls.find(c => c.method === 'POST' && c.path.endsWith('/reviews'))?.body).toEqual({
      rating: 5,
      content: 'Quán rất yên tĩnh và mát mẻ.',
    });
    expect(everything()).toContain('Quán rất yên tĩnh và mát mẻ.');

    // Delete own review via U17 confirm dialog
    await pressButton('Xóa');
    expect(everything()).toContain('Xóa đánh giá?');
    await pressButton('Xóa đánh giá');
    await flush();
    expect(calls.some(c => c.method === 'DELETE' && c.path === `/reviews/${sampleReview.id}`)).toBe(true);
  });

  test('lists favorites (U18) from Profile and removes one', async () => {
    let favs = [samplePlace];
    const { session, calls } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.method === 'GET' && call.path.startsWith('/users/me/favorites/places')) {
        return ok(page(favs));
      }
      if (call.method === 'DELETE' && call.path === `/users/me/favorites/places/${samplePlace.id}`) {
        favs = [];
        return noContent();
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    const profileTab = tree.root.find(
      n => n.props.route?.name === 'Profile' && typeof n.props.onPress === 'function',
    );
    await act(async () => {
      profileTab.props.onPress();
    });
    const favRow = tree.root
      .findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button' && textOf(n).includes('Địa điểm yêu thích'))
      .pop()!;
    await act(async () => {
      favRow.props.onPress();
    });
    await flush();

    expect(everything()).toContain('The Study Loft');
    await pressButton('Bỏ lưu');
    await flush();
    expect(calls.some(c => c.method === 'DELETE' && c.path === `/users/me/favorites/places/${samplePlace.id}`)).toBe(true);
  });
});
