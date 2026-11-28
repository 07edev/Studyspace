/**
 * @format
 */

import React from 'react';
import { Modal, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import StudySpaceApp from '../src/app/StudySpaceApp';
import { createApiClient } from '../src/shared/api/client';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import type { Place } from '../src/shared/contracts/places';
import { Button } from '../src/shared/ui/Button';

const ok = (data: unknown) =>
  ({
    status: 200,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'req-1' }),
    headers: { get: () => null },
  } as unknown as Response);

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

const samplePlace: Place = {
  id: '65f000000000000000000011',
  name: 'The Study Loft',
  category: 'CAFE',
  description: 'Không gian học tập yên tĩnh.',
  address: { line1: '88 Đồng Khởi', provinceCode: '79', countryCode: 'VN', displayText: '88 Đồng Khởi, Q1' },
  location: { lat: 10.7769, lng: 106.7009 },
  images: [{ fileId: 'f1', url: 'https://cdn.test/1.jpg', sortOrder: 0, isCover: true }],
  hours: [{ day: 'MON', closed: false, intervals: [{ open: '08:00', close: '22:00' }] }],
  amenities: ['WIFI', 'POWER_OUTLET'],
  quietLevel: 'QUIET',
  studySuitability: 'BOTH',
  origin: 'MANUAL',
  status: 'PUBLISHED',
  ratingAverage: 4.8,
  ratingCount: 15,
  isFavorite: false,
  openNow: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
};

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

type Call = { method: string; path: string; body?: unknown };

function makeSession(
  matcher: (call: Call) => Response | undefined,
  storedToken: string | null = null,
) {
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
    createMemoryTokenStorage(storedToken),
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
    throw new Error(`no pressable with accessibilityLabel "${label}"`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};

afterEach(async () => {
  await act(async () => tree.unmount());
});

describe('Mobile Places & Explore (M9: USR-07, USR-08, U07-U14)', () => {
  test('guest browses Home (GET /home), opens Place Detail (U13), and hits AuthGate on Favorite', async () => {
    const { session } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({
          categories: [{ id: 'c1', code: 'CAFE', name: 'Quán cà phê', active: true }],
          nearby: [samplePlace],
          topRated: [samplePlace],
          recentlyUpdated: [],
        });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([{ id: 'c1', code: 'CAFE', name: 'Quán cà phê', active: true }]));
      }
      if (call.path === `/places/${samplePlace.id}`) {
        return ok(samplePlace);
      }
      if (call.path === `/places/${samplePlace.id}/similar`) {
        return ok(page([]));
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    await pressButton('Bắt đầu khám phá');
    await flush();

    expect(everything()).toContain('The Study Loft');
    await pressByLabel(`Xem địa điểm ${samplePlace.name}`);
    await flush();

    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(everything()).toContain('88 Đồng Khởi, Q1');
    expect(everything()).toContain('4.8 (15 đánh giá)');

    // Guest tapping Favorite triggers U19 AuthGate
    await pressButton('Yêu thích');
    expect(everything()).toContain('Đăng nhập để lưu địa điểm yêu thích');
  });

  test('switches Explore to Map mode, handles MAP_BOUNDS_TOO_LARGE, and opens U12 on WebView markerPress', async () => {
    let mapRequests = 0;
    const { session } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path.startsWith('/places/map')) {
        mapRequests += 1;
        if (mapRequests === 1) {
          return fail(400, 'MAP_BOUNDS_TOO_LARGE', 'Vùng bản đồ quá lớn.');
        }
        return ok(
          page([
            {
              placeId: samplePlace.id,
              name: samplePlace.name,
              location: samplePlace.location,
              category: samplePlace.category,
            },
          ]),
        );
      }
      if (call.path.startsWith('/places?')) {
        return ok(page([samplePlace]));
      }
      if (call.path === `/places/${samplePlace.id}`) {
        return ok(samplePlace);
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    await pressButton('Bắt đầu khám phá');

    // Open Explore tab
    const exploreTab = tree.root.find(
      n => n.props.route?.name === 'Explore' && typeof n.props.onPress === 'function',
    );
    await act(async () => {
      exploreTab.props.onPress();
    });
    await flush();

    expect(everything()).toContain('The Study Loft');

    // Switch to Map mode -> 1st call returns MAP_BOUNDS_TOO_LARGE
    await pressByLabel('Chế độ bản đồ');
    await flush();
    expect(everything()).toContain('Vùng bản đồ đang quá rộng');

    // Simulate WebView zoom (boundsChange) -> 2nd call returns marker
    const webview = tree.root.findByProps({ testID: 'leaflet-webview' });
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'boundsChange', bbox: '106.68,10.76,106.72,10.79' }) },
      });
    });
    await flush();
    expect(everything()).toContain('Hiển thị 1 địa điểm');

    // Simulate markerPress -> opens U12 quick card
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'markerPress', placeId: samplePlace.id }) },
      });
    });
    await flush();
    expect(everything()).toContain('Thông tin nhanh');
    expect(everything()).toContain('Xem chi tiết');
  });

  test('signed-in user selects university/major (U07) and subjects (U08) from Profile edit', async () => {
    const patches: unknown[] = [];
    const { session } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path.startsWith('/taxonomies/universities')) {
        return ok(page([{ id: 'uni-1', code: 'HCMUS', name: 'ĐH Khoa học Tự nhiên', active: true }]));
      }
      if (call.path.startsWith('/taxonomies/majors')) {
        return ok(page([{ id: 'maj-1', code: 'CS', name: 'Khoa học Máy tính', parentId: 'uni-1', active: true }]));
      }
      if (call.path.startsWith('/taxonomies/subjects')) {
        return ok(page([{ id: 'sub-1', code: 'DSA', name: 'Cấu trúc dữ liệu', active: true }]));
      }
      if (call.method === 'PATCH' && call.path === '/users/me/profile') {
        patches.push(call.body);
        return ok({ ...user, profile: { ...user.profile, ...(call.body as object) } });
      }
      return undefined;
    }, 'refresh-1');

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    const profileTab = tree.root.find(
      n => n.props.route?.name === 'Profile' && typeof n.props.onPress === 'function',
    );
    await act(async () => {
      profileTab.props.onPress();
    });
    await pressButton('Chỉnh sửa hồ sơ');
    await pressButton('Chọn trường & ngành');
    await flush();

    // Pick university -> moves to majors -> pick major -> save
    await pressByLabel('ĐH Khoa học Tự nhiên');
    await flush();
    await pressByLabel('Khoa học Máy tính');
    await pressButton('Lưu trường & ngành');
    await flush();

    expect(patches[0]).toEqual({ universityId: 'uni-1', majorId: 'maj-1' });

    // Pick subjects (U08)
    await pressButton('Chọn môn quan tâm');
    await flush();
    const subjectRow = tree.root.findAll(
      n => typeof n.props.onPress === 'function' && textOf(n).includes('Cấu trúc dữ liệu'),
    ).pop()!;
    await act(async () => {
      subjectRow.props.onPress();
    });
    await pressButton('Lưu (1)');
    await flush();

    expect(patches[1]).toEqual({ subjectIds: ['sub-1'] });
  });
});
