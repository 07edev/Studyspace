import type { FieldError } from '@contracts/api';
import type { AccessTokens } from '@contracts/auth';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly requestId?: string,
    public readonly details: FieldError[] = [],
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  // false for public endpoints (login, forgot password): no bearer token, no refresh-and-retry.
  authenticated?: boolean;
  idempotencyKey?: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Only these 401 codes mean "the access token is bad": a wrong current password also answers 401
// and must not end the session.
const TOKEN_REJECTED = new Set(['UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_INVALID']);
export const isTokenRejected = (error: unknown) =>
  error instanceof ApiError && error.status === 401 && TOKEN_REJECTED.has(error.code);

// The refresh itself failed because the server refuses it (expired, reused, account locked) — as
// opposed to a network problem, where the session may still be fine.
const isRefreshRefused = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  fetcher = (...args) => fetch(...args),
  timeoutMs = 15_000,
  onSessionLost = () => undefined,
}: {
  baseUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  // Called once when the refresh token is refused, so the UI can go back to the login screen.
  onSessionLost?: () => void;
}) {
  let accessToken: string | undefined;
  let refreshing: Promise<void> | undefined;

  async function send<T>(path: string, options: RequestOptions, token?: string): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('API path must start with one slash');
    }
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (options.signal?.aborted) {
      throw new ApiError('CANCELLED', 'Yêu cầu đã được hủy.');
    }
    options.signal?.addEventListener('abort', cancel);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }
    const url = `${baseUrl.replace(/\/$/, '')}${path}${search.size > 0 ? `?${search}` : ''}`;
    try {
      const response = await fetcher(url, {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          // A non-simple header: forces a CORS preflight, which the refresh cookie relies on.
          'X-Requested-With': 'XMLHttpRequest',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      if (response.status === 204) {
        return undefined as T;
      }
      const payload: unknown = await response.json().catch(() => undefined);
      const requestId =
        record(payload) && typeof payload.requestId === 'string' ? payload.requestId : undefined;
      if (!response.ok || (record(payload) && payload.success === false)) {
        const error = record(payload) && record(payload.error) ? payload.error : {};
        const details = Array.isArray(error.details)
          ? error.details.filter(
              (item): item is FieldError =>
                record(item) &&
                typeof item.field === 'string' &&
                typeof item.rule === 'string' &&
                typeof item.message === 'string',
            )
          : [];
        const retryHeader = Number(response.headers.get('Retry-After'));
        throw new ApiError(
          typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
          typeof error.message === 'string'
            ? error.message
            : 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.',
          response.status,
          requestId,
          details,
          typeof error.retryAfterSeconds === 'number'
            ? error.retryAfterSeconds
            : retryHeader > 0
              ? retryHeader
              : undefined,
        );
      }
      if (!record(payload) || payload.success !== true || !('data' in payload)) {
        throw new ApiError('INVALID_RESPONSE', 'Phản hồi từ dịch vụ chưa hợp lệ.', response.status, requestId);
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (timedOut) {
        throw new ApiError('TIMEOUT', 'Kết nối mất nhiều thời gian. Vui lòng thử lại.');
      }
      if (controller.signal.aborted) {
        throw new ApiError('CANCELLED', 'Yêu cầu đã được hủy.');
      }
      throw new ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }

  // The refresh token rotates on every use, so two refreshes at once would look like token theft
  // to the server. All callers share one in-flight refresh.
  function refresh(): Promise<void> {
    refreshing ??= send<AccessTokens>(
      '/auth/token/refresh',
      { method: 'POST', body: { client: 'WEB_ADMIN' } },
    )
      .then(tokens => {
        accessToken = tokens.accessToken;
      })
      .catch(error => {
        if (isRefreshRefused(error)) {
          accessToken = undefined;
          onSessionLost();
        }
        throw error;
      })
      .finally(() => {
        refreshing = undefined;
      });
    return refreshing;
  }

  return {
    setAccessToken(token: string | undefined) {
      accessToken = token;
    },
    hasAccessToken: () => accessToken !== undefined,
    refresh,
    async request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
      if (options.authenticated === false) {
        return send<T>(path, options);
      }
      try {
        return await send<T>(path, options, accessToken);
      } catch (error) {
        if (!isTokenRejected(error)) {
          throw error;
        }
        // One refresh, one retry. A second rejection is returned as is, so there is no loop.
        await refresh();
        return send<T>(path, options, accessToken);
      }
    },
  };
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  onSessionLost: () => sessionLostListeners.forEach(listener => listener()),
});

const sessionLostListeners = new Set<() => void>();
export const onSessionLost = (listener: () => void) => {
  sessionLostListeners.add(listener);
  return () => {
    sessionLostListeners.delete(listener);
  };
};
