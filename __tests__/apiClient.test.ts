import {
  ApiError,
  createApiClient,
  fieldErrors,
} from '../src/shared/api/client';

function response(status: number, payload?: unknown, retryAfter?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(payload),
    headers: { get: () => retryAfter ?? null },
  } as unknown as Response;
}
const makeClient = (fetcher: jest.Mock, timeoutMs = 15000) =>
  createApiClient({
    baseUrl: 'https://example.test/api/v1/',
    fetcher,
    timeoutMs,
  });

test('unwraps the envelope and attaches explicit credentials only', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValue(
      response(200, { success: true, data: { id: '1' }, requestId: 'req-1' }),
    );
  await expect(
    makeClient(fetcher).request('/users/me', { accessToken: 'test-token' }),
  ).resolves.toEqual({ id: '1' });
  expect(fetcher).toHaveBeenCalledWith(
    'https://example.test/api/v1/users/me',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }),
  );
});

test('does not parse JSON for 204', async () => {
  const res = response(204);
  await expect(
    makeClient(jest.fn().mockResolvedValue(res)).request<void>('/auth/logout', {
      method: 'POST',
    }),
  ).resolves.toBeUndefined();
  expect(res.json).not.toHaveBeenCalled();
});

test('preserves field errors and requestId without retrying a mutation', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValue(
      response(422, {
        success: false,
        requestId: 'req-2',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email',
          details: [
            { field: 'email', rule: 'email', message: 'Email không hợp lệ' },
          ],
        },
      }),
    );
  let caught: unknown;
  try {
    await makeClient(fetcher).request('/auth/register', {
      method: 'POST',
      body: { email: 'bad' },
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({
    code: 'VALIDATION_ERROR',
    status: 422,
    requestId: 'req-2',
  });
  expect(fieldErrors(caught)).toEqual({ email: 'Email không hợp lệ' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('rejects malformed success responses', async () => {
  await expect(
    makeClient(
      jest.fn().mockResolvedValue(response(200, { user: '1' })),
    ).request('/users/me'),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});

test('maps 429 cooldown and network errors', async () => {
  await expect(
    makeClient(
      jest.fn().mockResolvedValue(response(429, undefined, '30')),
    ).request('/auth/login'),
  ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 });
  await expect(
    makeClient(jest.fn().mockRejectedValue(new TypeError('offline'))).request(
      '/users/me',
    ),
  ).rejects.toBeInstanceOf(ApiError);
});

test('pre-cancelled calls never reach the network', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = jest.fn();
  await expect(
    makeClient(fetcher).request('/users/me', { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(fetcher).not.toHaveBeenCalled();
});

test('times out and distinguishes cancellation from a network failure', async () => {
  jest.useFakeTimers();
  const fetcher = jest.fn(
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
  );
  const result = makeClient(fetcher, 50).request('/users/me').catch(error => error);
  await jest.advanceTimersByTimeAsync(51);
  expect(await result).toMatchObject({ code: 'TIMEOUT' });
  jest.useRealTimers();
});
