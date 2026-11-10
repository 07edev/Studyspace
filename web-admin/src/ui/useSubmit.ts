import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../lib/api';

/**
 * Wrapper for a form submit: blocks a second click while one is running, and turns a failed call
 * into field errors (`fields`, from 422 details) plus one general `message`.
 * `run` resolves to the result, or undefined when it failed.
 */
export function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError>();
  const busy = useRef(false);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      return await action();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError('UNKNOWN', 'Đã xảy ra lỗi. Vui lòng thử lại.'),
      );
      return undefined;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);

  const fields: Record<string, string> = {};
  for (const detail of error?.details ?? []) {
    fields[detail.field] ??= detail.message;
  }
  // Show the general message only when no field explains the problem.
  const message = error && Object.keys(fields).length === 0 ? error.message : undefined;
  return { run, pending, error, fields, message, reset: () => setError(undefined) };
}
