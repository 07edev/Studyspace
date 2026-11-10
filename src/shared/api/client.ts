import type { FieldError } from '../contracts/api';

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
type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  accessToken?: string;
  idempotencyKey?: string;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function createApiClient({
  baseUrl,
  timeoutMs = 15000,
  fetcher = fetch,
}: {
  baseUrl: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}) {
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error('An absolute API baseUrl is required');
  }
  return {
    async request<T = void>(path: string, options: Options = {}): Promise<T> {
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
      try {
        const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
          method: options.method ?? 'GET',
          headers: {
            Accept: 'application/json',
            ...(options.body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
            ...(options.accessToken
              ? { Authorization: `Bearer ${options.accessToken}` }
              : {}),
            ...(options.idempotencyKey
              ? { 'Idempotency-Key': options.idempotencyKey }
              : {}),
          },
          body:
            options.body !== undefined
              ? JSON.stringify(options.body)
              : undefined,
          signal: controller.signal,
        });
        // 204 has no JSON body. Callers use request<void> for these operations.
        if (response.status === 204) {
          return undefined as T;
        }
        const payload: unknown = await response.json().catch(() => undefined);
        const requestId =
          record(payload) && typeof payload.requestId === 'string'
            ? payload.requestId
            : undefined;
        if (!response.ok || (record(payload) && payload.success === false)) {
          const error =
            record(payload) && record(payload.error) ? payload.error : {};
          const details = Array.isArray(error.details)
            ? error.details.filter(
                (item): item is FieldError =>
                  record(item) &&
                  typeof item.field === 'string' &&
                  typeof item.rule === 'string' &&
                  typeof item.message === 'string',
              )
            : [];
          const retryAfter = Number(response.headers.get('Retry-After'));
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
              : retryAfter > 0
              ? retryAfter
              : undefined,
          );
        }
        if (
          !record(payload) ||
          payload.success !== true ||
          !('data' in payload) ||
          !requestId
        ) {
          throw new ApiError(
            'INVALID_RESPONSE',
            'Phản hồi từ dịch vụ chưa hợp lệ.',
            response.status,
            requestId,
          );
        }
        return payload.data as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        if (timedOut) {
          throw new ApiError(
            'TIMEOUT',
            'Kết nối mất nhiều thời gian. Vui lòng thử lại.',
          );
        }
        if (controller.signal.aborted) {
          throw new ApiError('CANCELLED', 'Yêu cầu đã được hủy.');
        }
        throw new ApiError(
          'NETWORK_ERROR',
          'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.',
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancel);
      }
    },
  };
}
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) {
    return {};
  }
  return Object.fromEntries(
    error.details.map(detail => [detail.field, detail.message]),
  );
}
