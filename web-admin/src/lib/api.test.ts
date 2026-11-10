import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';
import { fail, ok } from '../test/helpers';

const tokens = (accessToken: string) => ok({ accessToken, tokenType: 'Bearer', expiresInSeconds: 900 });
const auth = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

function setup(handler: (path: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const seen = new Map<string, number>();
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input).replace('/api/v1', '').split('?')[0];
    const n = (seen.get(path) ?? 0) + 1;
    seen.set(path, n);
    return handler(path, init, n);
  }) as unknown as typeof fetch;
  const onSessionLost = vi.fn();
  const client = createApiClient({ baseUrl: '/api/v1', fetcher, onSessionLost });
  return { client, fetcher, onSessionLost, calls: (p: string) => seen.get(p) ?? 0 };
}

describe('api client', () => {
  beforeEach(() => vi.useRealTimers());

  it('unwraps the envelope, sends the bearer token and builds the query string', async () => {
    const { client, fetcher } = setup(() => ok({ hello: 'world' }));
    client.setAccessToken('tok');
    const data = await client.request('/things', { query: { page: 2, q: 'abc', empty: undefined, blank: '' } });
    expect(data).toEqual({ hello: 'world' });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/v1/things?page=2&q=abc');
    expect(auth(init)).toBe('Bearer tok');
    expect((init.headers as Record<string, string>)['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('turns an error envelope into ApiError with code, details and request id', async () => {
    const { client } = setup(() =>
      fail(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', { details: [{ field: 'email', rule: 'isEmail', message: 'Sai email' }] }),
    );
    const error = await client.request('/x', { authenticated: false }).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', status: 422, requestId: 'req-err' });
    expect(error.details[0].field).toBe('email');
  });

  it('refreshes once on an expired token and retries the request with the new token', async () => {
    const { client, calls } = setup((path, init, n) => {
      if (path === '/auth/token/refresh') return tokens('fresh');
      return auth(init) === 'Bearer fresh' ? ok({ n }) : fail(401, 'TOKEN_EXPIRED', 'Hết hạn');
    });
    client.setAccessToken('stale');
    expect(await client.request('/data')).toEqual({ n: 2 });
    expect(calls('/auth/token/refresh')).toBe(1);
  });

  it('shares one refresh between simultaneous requests (the refresh token rotates)', async () => {
    const { client, calls } = setup(async (path, init) => {
      if (path === '/auth/token/refresh') {
        await new Promise(r => setTimeout(r, 20));
        return tokens('fresh');
      }
      return auth(init) === 'Bearer fresh' ? ok({}) : fail(401, 'TOKEN_EXPIRED', 'Hết hạn');
    });
    client.setAccessToken('stale');
    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    expect(calls('/auth/token/refresh')).toBe(1);
  });

  it('does not refresh (or sign out) when the 401 is not about the token', async () => {
    const { client, calls, onSessionLost } = setup(() => fail(401, 'INVALID_CREDENTIALS', 'Sai mật khẩu'));
    client.setAccessToken('good');
    await expect(client.request('/auth/password/change', { method: 'POST' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(calls('/auth/token/refresh')).toBe(0);
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('never loops: a second rejection after refreshing is returned to the caller', async () => {
    const { client, calls } = setup(path =>
      path === '/auth/token/refresh' ? tokens('fresh') : fail(401, 'TOKEN_INVALID', 'Không hợp lệ'),
    );
    client.setAccessToken('stale');
    await expect(client.request('/data')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(calls('/data')).toBe(2);
    expect(calls('/auth/token/refresh')).toBe(1);
  });

  it('reports a lost session when the server refuses the refresh', async () => {
    const { client, onSessionLost } = setup(path =>
      path === '/auth/token/refresh' ? fail(401, 'TOKEN_INVALID', 'Hết phiên') : fail(401, 'TOKEN_EXPIRED', 'Hết hạn'),
    );
    client.setAccessToken('stale');
    await expect(client.request('/data')).rejects.toBeInstanceOf(ApiError);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(client.hasAccessToken()).toBe(false);
  });

  it('keeps the session when the refresh fails only because the network is down', async () => {
    const { client, onSessionLost } = setup(path => {
      if (path === '/auth/token/refresh') throw new TypeError('network down');
      return fail(401, 'TOKEN_EXPIRED', 'Hết hạn');
    });
    client.setAccessToken('stale');
    await expect(client.request('/data')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('does not attach a token or refresh for public endpoints', async () => {
    const { client, fetcher, calls } = setup(() => fail(401, 'TOKEN_EXPIRED', 'x'));
    client.setAccessToken('tok');
    await expect(client.request('/auth/login', { method: 'POST', authenticated: false })).rejects.toBeInstanceOf(ApiError);
    expect(auth((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1])).toBeUndefined();
    expect(calls('/auth/token/refresh')).toBe(0);
  });

  it('handles 204 with no body and rejects malformed success payloads', async () => {
    const empty = setup(() => ok(undefined, 204));
    await expect(empty.client.request('/gone', { method: 'DELETE', authenticated: false })).resolves.toBeUndefined();
    const bad = setup(() => new Response('{"hello":1}', { status: 200 }));
    await expect(bad.client.request('/x', { authenticated: false })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('refuses paths that could leave the API origin', async () => {
    const { client } = setup(() => ok({}));
    await expect(client.request('//evil.test/x')).rejects.toThrow();
    await expect(client.request('x')).rejects.toThrow();
  });

  it('times out with a clear error', async () => {
    const fetcher = ((_: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    const client = createApiClient({ baseUrl: '/api/v1', fetcher, timeoutMs: 10 });
    await expect(client.request('/slow', { authenticated: false })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
