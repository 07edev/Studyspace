import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fieldErrors } from '../../shared/api/client';
import { useModal } from '../../navigation/ModalCoordinator';

/**
 * Runs one async submit at a time (a second tap while pending is ignored, so no duplicate
 * mutation), and exposes the failure as per-field messages plus one general message.
 */
export function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // `onError` runs with the fresh error (state read right after run() would still be stale).
  const run = useCallback(async <T,>(task: () => Promise<T>, onError?: (error: ApiError) => void) => {
    if (busy.current) {
      return undefined;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      return await task();
    } catch (caught) {
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError('UNKNOWN', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      if (mounted.current) {
        setError(apiError);
        onError?.(apiError);
      }
      return undefined;
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
      }
    }
  }, []);

  const fields = fieldErrors(error);
  return {
    run,
    pending,
    error,
    fields,
    // Shown above the button when the failure is not about a specific field.
    message: error && Object.keys(fields).length === 0 ? error.message : undefined,
    clear: useCallback(() => setError(null), []),
  };
}

/** Marks the modal as having unsaved input, so closing asks first (dirty guard). */
export function useDirtyGuard(dirty: boolean) {
  const { setDirty } = useModal();
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  // Clean up so a finished form never blocks the next navigation.
  useEffect(() => () => setDirty(false), [setDirty]);
}

/** Seconds left before an action (resend code) is allowed again. */
export function useCountdown(initialSeconds = 0) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil(initialSeconds)));
  useEffect(() => {
    if (left <= 0) {
      return;
    }
    const timer = setTimeout(() => setLeft(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, start: (seconds: number) => setLeft(Math.max(0, Math.ceil(seconds))) };
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
