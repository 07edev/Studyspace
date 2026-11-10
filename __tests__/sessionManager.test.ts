import { createApiClient } from '../src/shared/api/client';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import type { AuthSession, User } from '../src/shared/contracts/auth';

const user: User = {
  id: 'u1',
  email: 'a@example.test',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const ok = (data: unknown, status = 200) =>
  ({
    status,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);
const fail = (status: number, code: string) =>
  ({
    status,
    ok: false,
    json: async () => ({
      success: false,
      error: { code, message: code },
      requestId: 'r',
    }),
    headers: { get: () => null },
  } as unknown as Response);
const empty = () =>
  ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response);

type Route = (init: RequestInit) => Response | Promise<Response>;
function setup(routes: Record<string, Route>, stored: string | null = null) {
  const calls: { path: string; auth?: string; body?: unknown }[] = [];
  const fetcher = jest.fn(async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.test', '');
    const headers = init.headers as Record<string, string>;
    calls.push({
      path,
      auth: headers.Authorization,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const route = routes[path];
    if (!route) {
      throw new Error(`unexpected ${path}`);
    }
    return route(init);
  });
  const storage = createMemoryTokenStorage(stored);
  const manager = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    storage,
  );
  return { manager, storage, calls };
}
const session = (access: string, refresh: string): AuthSession => ({
  user,
  tokens: { accessToken: access, tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: refresh },
});

test('startSession keeps the refresh token in secure storage and the user in state', async () => {
  const { manager, storage } = setup({});
  await manager.startSession(session('access-1', 'refresh-1'));
  expect(storage.peek()).toBe('refresh-1');
  expect(manager.getState()).toMatchObject({ status: 'authenticated', user });
});

test('restore turns a stored refresh token into a session and saves the rotated token', async () => {
  const { manager, storage, calls } = setup(
    {
      '/auth/token/refresh': () =>
        ok({ accessToken: 'access-2', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'refresh-2' }),
      '/auth/me': () => ok(user),
    },
    'refresh-1',
  );
  await manager.restore();
  expect(manager.getState().status).toBe('authenticated');
  expect(storage.peek()).toBe('refresh-2');
  expect(calls[0].body).toEqual({ refreshToken: 'refresh-1', client: 'MOBILE' });
  expect(calls[1].auth).toBe('Bearer access-2');
});

test('restore with nothing stored is simply a guest', async () => {
  const { manager, calls } = setup({});
  await manager.restore();
  expect(manager.getState()).toEqual({ status: 'guest' });
  expect(calls).toHaveLength(0);
});

test('restore drops a rejected token and remembers why', async () => {
  const { manager, storage } = setup(
    { '/auth/token/refresh': () => fail(401, 'TOKEN_REUSED') },
    'stolen',
  );
  await manager.restore();
  expect(manager.getState()).toEqual({ status: 'guest', endedReason: 'expired' });
  expect(storage.peek()).toBeNull();
});

test('restore keeps the token when the network is down so the next launch can retry', async () => {
  const { manager, storage } = setup(
    {
      '/auth/token/refresh': () => {
        throw new TypeError('offline');
      },
    },
    'refresh-1',
  );
  await manager.restore();
  expect(manager.getState()).toEqual({ status: 'guest' });
  expect(storage.peek()).toBe('refresh-1');
});

test('a 401 triggers one refresh and one retry of the request', async () => {
  let first = true;
  const { manager, calls } = setup({
    '/users/me': () => {
      if (first) {
        first = false;
        return fail(401, 'UNAUTHORIZED');
      }
      return ok(user);
    },
    '/auth/token/refresh': () =>
      ok({ accessToken: 'access-2', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'refresh-2' }),
  });
  await manager.startSession(session('access-1', 'refresh-1'));
  await expect(manager.request('/users/me')).resolves.toEqual(user);
  expect(calls.map(c => c.path)).toEqual(['/users/me', '/auth/token/refresh', '/users/me']);
  expect(calls[0].auth).toBe('Bearer access-1');
  expect(calls[2].auth).toBe('Bearer access-2');
});

test('concurrent 401s share ONE refresh (the server rotates tokens)', async () => {
  const seen = new Set<string>();
  const { manager, calls } = setup({
    '/users/me': init => {
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer access-2' ? ok(user) : fail(401, 'UNAUTHORIZED');
    },
    '/auth/token/refresh': async () => {
      seen.add('x');
      await new Promise<void>(resolve => setTimeout(resolve, 20));
      return ok({ accessToken: 'access-2', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'refresh-2' });
    },
  });
  await manager.startSession(session('access-1', 'refresh-1'));
  await Promise.all([manager.request('/users/me'), manager.request('/users/me'), manager.request('/users/me')]);
  expect(calls.filter(c => c.path === '/auth/token/refresh')).toHaveLength(1);
});

test('never loops: a 401 right after a successful refresh ends the session', async () => {
  const { manager, calls } = setup({
    '/users/me': () => fail(401, 'UNAUTHORIZED'),
    '/auth/token/refresh': () =>
      ok({ accessToken: 'access-2', tokenType: 'Bearer', expiresInSeconds: 900, refreshToken: 'refresh-2' }),
  });
  await manager.startSession(session('access-1', 'refresh-1'));
  await expect(manager.request('/users/me')).rejects.toMatchObject({ status: 401 });
  expect(calls.filter(c => c.path === '/auth/token/refresh')).toHaveLength(1);
  expect(manager.getState()).toEqual({ status: 'guest', endedReason: 'expired' });
});

test('a failed refresh ends the session and clears secure storage', async () => {
  const { manager, storage } = setup({
    '/users/me': () => fail(401, 'UNAUTHORIZED'),
    '/auth/token/refresh': () => fail(401, 'TOKEN_EXPIRED'),
  });
  await manager.startSession(session('access-1', 'refresh-1'));
  await expect(manager.request('/users/me')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  expect(manager.getState()).toEqual({ status: 'guest', endedReason: 'expired' });
  expect(storage.peek()).toBeNull();
});

test('a suspended account is signed out with its own reason', async () => {
  const { manager, storage } = setup({ '/users/me': () => fail(403, 'ACCOUNT_SUSPENDED') });
  await manager.startSession(session('access-1', 'refresh-1'));
  await expect(manager.request('/users/me')).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  expect(manager.getState()).toEqual({ status: 'guest', endedReason: 'suspended' });
  expect(storage.peek()).toBeNull();
});

test('other errors (403 forbidden, 422, network) do not touch the session', async () => {
  const { manager } = setup({ '/admin/x': () => fail(403, 'FORBIDDEN') });
  await manager.startSession(session('access-1', 'refresh-1'));
  await expect(manager.request('/admin/x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(manager.getState().status).toBe('authenticated');
});

test('requests without any session fail locally with 401 and never hit the network', async () => {
  const { manager, calls } = setup({});
  await expect(manager.request('/users/me')).rejects.toMatchObject({ status: 401 });
  expect(calls).toHaveLength(0);
});

test('logout always clears the local session, even when the server call fails', async () => {
  const { manager, storage } = setup({
    '/auth/logout': () => {
      throw new TypeError('offline');
    },
  });
  await manager.startSession(session('access-1', 'refresh-1'));
  await manager.logout();
  expect(manager.getState()).toEqual({ status: 'guest' });
  expect(storage.peek()).toBeNull();
});

test('logout tells the server to revoke the session', async () => {
  const { manager, calls } = setup({ '/auth/logout': () => empty() });
  await manager.startSession(session('access-1', 'refresh-1'));
  await manager.logout();
  expect(calls[0]).toMatchObject({ path: '/auth/logout', auth: 'Bearer access-1' });
});
