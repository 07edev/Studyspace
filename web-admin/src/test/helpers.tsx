import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { User } from '@contracts/auth';
import { App } from '../app/App';
import { Providers } from '../app/Providers';
import { api } from '../lib/api';

export const ok = (data: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify({ success: true, data, requestId: 'req-1' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: false, error: { code, message, ...extra }, requestId: 'req-err' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const makeAdmin = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'Ada Admin' },
  createdAt: '2026-01-01T00:00:00.000Z',
  admin: { status: 'ACTIVE', permissions: [{ module: 'USERS', actions: ['READ'] }] },
  ...overrides,
});

export const tokens = { accessToken: 'access-1', tokenType: 'Bearer', expiresInSeconds: 900 };

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** Replaces fetch with a router: key is "METHOD /path" (without /api/v1). Unknown calls fail the test. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const key = `${init.method ?? 'GET'} ${url.pathname.replace(/^\/api\/v1/, '')}`;
    calls.push({ key, init });
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, count: (key: string) => calls.filter(c => c.key === key).length };
}

export const signedIn = (user: User = makeAdmin()) => ({
  'POST /auth/token/refresh': () => ok(tokens),
  'GET /auth/me': () => ok(user),
});

export const superAdmin = (overrides: Partial<User> = {}) =>
  makeAdmin({ id: 'root1', email: 'root@example.test', role: 'SUPER_ADMIN', admin: { status: 'ACTIVE', permissions: [] }, ...overrides });

export const page = <T,>(
  items: T[],
  extra: Partial<{ page: number; total: number; totalPages: number; hasNext: boolean }> = {},
) => ({ items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1, hasNext: false, ...extra } });

export const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'user1',
  email: 'an@example.test',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An Nguyen' },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const body = (init: RequestInit) => JSON.parse(String(init.body));

export function resetApi() {
  api.setAccessToken(undefined);
  vi.unstubAllGlobals();
}

export function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Providers client={client}>
        <App />
      </Providers>
    </MemoryRouter>,
  );
}
