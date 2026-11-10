import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthSession, User } from '@contracts/auth';
import { api, ApiError, onSessionLost } from '../lib/api';
import { isAdminUser } from './permissions';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'error'; error: ApiError }
  | { status: 'signedIn'; user: User };

type AuthContextValue = {
  state: AuthState;
  user: User | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Re-read the account (permissions may have changed since sign-in).
  reloadUser: () => Promise<void>;
  retryRestore: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const NOT_ADMIN = 'Tài khoản này không có quyền quản trị.';

// Refreshing rotates the token, so it must happen once even though React StrictMode runs the
// effect twice in development. Both runs share this promise.
let restoring: Promise<User | undefined> | undefined;
async function restoreSession(): Promise<User | undefined> {
  try {
    await api.refresh();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return undefined; // no valid session: show the login screen
    }
    throw error;
  }
  return api.request<User>('/auth/me');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    restoring ??= restoreSession().finally(() => {
      restoring = undefined;
    });
    restoring.then(
      user => {
        if (!active) return;
        setState(isAdminUser(user) ? { status: 'signedIn', user } : { status: 'signedOut' });
      },
      error => {
        if (active) {
          setState({
            status: 'error',
            error: error instanceof ApiError ? error : new ApiError('NETWORK_ERROR', 'Không thể kết nối.'),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(
    () =>
      onSessionLost(() => {
        queryClient.clear();
        setState({ status: 'signedOut', notice: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
      }),
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.request<AuthSession>('/auth/login', {
        method: 'POST',
        body: { email, password, client: 'WEB_ADMIN' },
        authenticated: false,
      });
      if (!isAdminUser(session.user)) {
        throw new ApiError('FORBIDDEN', NOT_ADMIN, 403);
      }
      api.setAccessToken(session.tokens.accessToken);
      queryClient.clear(); // nothing cached by a previous person may reach this one
      setState({ status: 'signedIn', user: session.user });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.request('/auth/logout', { method: 'POST' });
    } catch {
      // Leaving must always work, even offline: the cookie expires on its own.
    }
    api.setAccessToken(undefined);
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [queryClient]);

  const reloadUser = useCallback(async () => {
    const user = await api.request<User>('/auth/me');
    setState(isAdminUser(user) ? { status: 'signedIn', user } : { status: 'signedOut', notice: NOT_ADMIN });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'signedIn' ? state.user : undefined,
      login,
      logout,
      reloadUser,
      retryRestore: () => {
        setState({ status: 'loading' });
        setAttempt(n => n + 1);
      },
    }),
    [state, login, logout, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

/** The signed-in admin. Only call it inside routes that are already behind RequireAdmin. */
export function useAdmin(): User {
  const { user } = useAuth();
  if (!user) {
    throw new Error('useAdmin used while signed out');
  }
  return user;
}
