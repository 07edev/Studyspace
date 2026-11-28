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
import type { Place, Suggestion } from '../src/shared/contracts/places';
import { Button } from '../src/shared/ui/Button';

const ok = (data: unknown, status = 200) =>
  ({
    status,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'req-1' }),
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
  address: { line1: '88 Đồng Khởi', provinceCode: '79', countryCode: 'VN' },
  location: { lat: 10.7769, lng: 106.7009 },
  images: [],
  hours: [],
  amenities: [],
  quietLevel: 'QUIET',
  studySuitability: 'BOTH',
  origin: 'MANUAL',
  status: 'PUBLISHED',
  ratingAverage: 4.6,
  ratingCount: 5,
  fieldStates: [{ path: 'name', verified: 'VERIFIED', locked: true }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
};

const rejectedSuggestion: Suggestion = {
  id: '65f000000000000000000081',
  type: 'CREATE',
  proposedPlace: {
    name: 'Quán Học Mới',
    category: 'CAFE',
    address: { line1: '10 Pasteur', provinceCode: '79', countryCode: 'VN' },
    location: { lat: 10.78, lng: 106.7 },
    origin: 'USER_SUGGESTION',
  },
  status: 'REJECTED',
  rejectionReason: 'Địa điểm đã trùng với cơ sở hiện có trên bản đồ.',
  submittedBy: { id: user.id, displayName: 'An' },
  createdAt: '2026-02-01T00:00:00.000Z',
  reviewedAt: '2026-02-02T00:00:00.000Z',
  version: 2,
};

type Call = { method: string; path: string; body?: unknown; headers?: Record<string, string> };

function makeSession(matcher: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetcher = jest.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.replace('https://api.test', ''),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
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

describe('Mobile Place Suggestions (M10: U20-U27)', () => {
  test('submits CREATE suggestion through U20 -> U21 map pick -> U22 duplicate check -> U25 with Idempotency-Key', async () => {
    const { session, calls } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path.startsWith('/locations/provinces')) {
        return ok(page([{ id: 'p1', code: '79', name: 'TP. Hồ Chí Minh', active: true }]));
      }
      if (call.path.startsWith('/locations/wards')) {
        return ok(page([]));
      }
      if (call.method === 'POST' && call.path === '/place-suggestions/duplicate-check') {
        return ok({
          requiresReview: true,
          possibleDuplicates: [
            {
              placeId: samplePlace.id,
              name: samplePlace.name,
              category: 'CAFE',
              status: 'PUBLISHED',
              distanceMeters: 45,
              similarityScore: 0.72,
            },
          ],
        });
      }
      if (call.method === 'POST' && call.path === '/place-suggestions') {
        return ok(rejectedSuggestion, 201);
      }
      if (call.method === 'GET' && call.path.startsWith('/users/me/place-suggestions')) {
        return ok(page([rejectedSuggestion]));
      }
      return undefined;
    });

    await act(async () => {
      tree = ReactTestRenderer.create(<StudySpaceApp session={session} />);
    });
    await flush();

    // Open U20 from Home
    await pressButton('Đề xuất địa điểm mới');
    await flush();
    await type('Tên địa điểm *', 'Góc Học Mới');
    await type('Địa chỉ chi tiết *', '22 Hai Bà Trưng');

    // U21 map coordinate pick
    await pressButton('Chọn vị trí trên bản đồ');
    const webview = tree.root.findByProps({ testID: 'leaflet-webview' });
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: 'selectPoint', lat: 10.7812, lng: 106.7015 }) },
      });
    });
    await pressButton('Xác nhận vị trí');

    // Trigger duplicate check -> U22 warning
    await pressButton('Tiếp tục (Kiểm tra trùng)');
    await flush();
    expect(everything()).toContain('Phát hiện địa điểm gần giống');
    expect(everything()).toContain('The Study Loft');

    // Continue -> U25 confirm -> POST with Idempotency-Key
    await pressButton('Không trùng, tiếp tục xác nhận');
    await pressButton('Xác nhận gửi đề xuất');
    await flush();

    const post = calls.find(c => c.method === 'POST' && c.path === '/place-suggestions');
    expect(post).toBeDefined();
    expect(post?.headers?.['Idempotency-Key']).toMatch(/^suggest-create-/);
    expect(post?.body).toMatchObject({
      type: 'CREATE',
      proposedPlace: {
        name: 'Góc Học Mới',
        location: { lat: 10.7812, lng: 106.7015 },
      },
    });
  });

  test('lists my suggestions (U26) and opens detail (U27) displaying rejectionReason', async () => {
    const { session } = makeSession(call => {
      if (call.path.startsWith('/home')) {
        return ok({ categories: [], nearby: [], topRated: [], recentlyUpdated: [] });
      }
      if (call.path.startsWith('/taxonomies/place-categories')) {
        return ok(page([]));
      }
      if (call.path.startsWith('/users/me/place-suggestions?')) {
        return ok(page([rejectedSuggestion]));
      }
      if (call.path === `/users/me/place-suggestions/${rejectedSuggestion.id}`) {
        return ok(rejectedSuggestion);
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
    const sugRow = tree.root
      .findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button' && textOf(n).includes('Đề xuất của tôi'))
      .pop()!;
    await act(async () => {
      sugRow.props.onPress();
    });
    await flush();

    expect(everything()).toContain('Quán Học Mới');
    const cardBtn = tree.root
      .findAll(n => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === 'Xem đề xuất Quán Học Mới')
      .pop()!;
    await act(async () => {
      cardBtn.props.onPress();
    });
    await flush();

    expect(everything()).toContain('Lý do từ chối từ quản trị viên');
    expect(everything()).toContain('Địa điểm đã trùng với cơ sở hiện có trên bản đồ.');
  });
});
