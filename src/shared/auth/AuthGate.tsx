import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useModal } from '../../navigation/ModalCoordinator';
import { ApiError } from '../api/client';
import { useToast } from '../ui';
import { useSession } from './AuthProvider';

export type GateRequest = {
  /** Why signing in is needed; shown in U19 ("Đăng nhập để xem thông báo dành cho bạn."). */
  reason: string;
  /**
   * What to do once the person is signed in. Capture what you need (typed text, the selected item)
   * in the closure: the form that was open is gone by then, the closure is the draft.
   */
  action: () => void | Promise<void>;
  /** Checked right before resuming; return false when the action no longer makes sense. */
  isStillValid?: () => boolean;
  /** How long after the request it may still be resumed. Default 10 minutes. */
  maxAgeMs?: number;
};

type Gate = {
  /**
   * Runs `request.action` now when signed in and returns true. Otherwise opens U19, remembers the
   * request and runs it once sign-in succeeds (returns false). The request is dropped if the person
   * gives up, waits too long or `isStillValid` says no.
   */
  requireAuth: (request: GateRequest) => boolean;
};

export const DEFAULT_MAX_AGE_MS = 10 * 60_000;

const GateContext = createContext<Gate | null>(null);

type Pending = { request: GateRequest; createdAt: number; flowSeen: boolean };

/**
 * U19: the one place that answers "this needs an account". Screens call `requireAuth`; they do not
 * open the login screens themselves and do not need to remember what the person wanted.
 */
export function AuthGateProvider({ children }: PropsWithChildren) {
  const session = useSession();
  const { state, open } = useModal();
  const toast = useToast();
  const pending = useRef<Pending | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const run = useCallback(async (request: GateRequest) => {
    try {
      await request.action();
    } catch (error) {
      toastRef.current(
        error instanceof ApiError
          ? error.message
          : 'Chưa thực hiện được. Vui lòng thử lại.',
      );
    }
  }, []);

  const requireAuth = useCallback(
    (request: GateRequest) => {
      if (session.status === 'authenticated') {
        run(request);
        return true;
      }
      if (session.status === 'restoring') {
        return false; // the saved session is still being read; the shell shows a loader meanwhile
      }
      pending.current = { request, createdAt: Date.now(), flowSeen: false };
      open({ name: 'auth-required', reason: request.reason });
      return false;
    },
    [session.status, open, run],
  );

  const activeName = state.active?.name;
  useEffect(() => {
    const waiting = pending.current;
    if (!waiting) {
      return;
    }
    // U19 and the sign-in / sign-up / verify screens are all "the sign-in flow".
    if (activeName === 'auth-required' || activeName === 'auth') {
      waiting.flowSeen = true;
      return;
    }
    if (session.status === 'authenticated') {
      if (activeName) {
        return; // steps after sign-up (complete your profile) come first
      }
      pending.current = null; // runs once, whatever happens next
      const { request, createdAt } = waiting;
      if (Date.now() - createdAt > (request.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) {
        return;
      }
      if (request.isStillValid && !request.isStillValid()) {
        toastRef.current('Hành động trước đó không còn phù hợp. Bạn có thể thử lại.');
        return;
      }
      run(request);
    } else if (waiting.flowSeen && !activeName) {
      pending.current = null; // closed without signing in: forget it
    }
  }, [activeName, session.status, run]);

  const value = useMemo(() => ({ requireAuth }), [requireAuth]);
  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useAuthGate(): Gate {
  const value = useContext(GateContext);
  if (!value) {
    throw new Error('useAuthGate must be used inside AuthGateProvider');
  }
  return value;
}
