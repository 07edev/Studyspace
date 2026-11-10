import type { AccessTokens, AuthSession, User } from '../contracts/auth';
import { ApiError, createApiClient } from '../api/client';
import type { TokenStorage } from './tokenStorage';

type Api = ReturnType<typeof createApiClient>;
type RequestOptions = Parameters<Api['request']>[1];

export type SessionState = {
  // restoring: reading the stored token at startup. guest: no session.
  status: 'restoring' | 'guest' | 'authenticated';
  user?: User;
  // Why a previous session ended, so the UI can explain it (U57). Cleared on next login.
  endedReason?: 'expired' | 'suspended';
};

/**
 * Owns the login session: in-memory access token, refresh token in secure storage,
 * automatic refresh and the "session ended" transitions. UI-agnostic so it is unit tested.
 *
 * Rules (from the plan, I07):
 *  - a request that gets 401 refreshes at most ONCE and is retried at most once (no loops);
 *  - concurrent 401s share a single refresh call (the server rotates tokens, so two refreshes
 *    with the same token would look like token theft and kill the session);
 *  - a failed refresh or a suspended account ends the session locally.
 */
export class SessionManager {
  private state: SessionState = { status: 'restoring' };
  private accessToken?: string;
  private refreshing?: Promise<void>;
  private listeners = new Set<() => void>();

  constructor(
    private readonly api: Api,
    private readonly storage: TokenStorage,
  ) {}

  // ---- state ----
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private setState(next: SessionState) {
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  // ---- lifecycle ----
  /** Called once at startup: turns a stored refresh token back into a session, if still valid. */
  async restore(): Promise<void> {
    const stored = await this.storage.get();
    if (!stored) {
      this.setState({ status: 'guest' });
      return;
    }
    try {
      await this.refreshTokens(stored);
      const user = await this.api.request<User>('/auth/me', {
        accessToken: this.accessToken,
      });
      this.setState({ status: 'authenticated', user });
    } catch (error) {
      if (this.isSessionRejection(error)) {
        await this.endLocally(error);
      } else {
        // Offline at launch: keep the stored token so the next launch can retry.
        this.accessToken = undefined;
        this.setState({ status: 'guest' });
      }
    }
  }

  /** Stores the result of login / register-verify / Google login. */
  async startSession(session: AuthSession): Promise<void> {
    const { accessToken, refreshToken } = session.tokens;
    if (!refreshToken) {
      throw new ApiError('INVALID_RESPONSE', 'Phản hồi từ dịch vụ chưa hợp lệ.');
    }
    await this.storage.set(refreshToken);
    this.accessToken = accessToken;
    this.setState({ status: 'authenticated', user: session.user });
  }

  async logout(): Promise<void> {
    const token = this.accessToken;
    try {
      if (token) {
        await this.api.request<void>('/auth/logout', {
          method: 'POST',
          accessToken: token,
        });
      }
    } catch {
      // The server session may already be gone; the local session must end regardless.
    }
    await this.clear();
    this.setState({ status: 'guest' });
  }

  // ---- requests ----
  /** For endpoints that need no login (register, login, forgot password...). */
  publicRequest<T = void>(path: string, options?: RequestOptions): Promise<T> {
    return this.api.request<T>(path, options);
  }

  /** Authenticated request with transparent refresh. Throws ApiError. */
  async request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.accessToken) {
      const stored = await this.storage.get();
      if (!stored) {
        throw new ApiError('UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục.', 401);
      }
      await this.refreshShared(stored);
    }
    try {
      return await this.api.request<T>(path, { ...options, accessToken: this.accessToken });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACCOUNT_SUSPENDED') {
        await this.endLocally(error);
        throw error;
      }
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      // Expired or revoked access token: refresh once, retry once.
      const stored = await this.storage.get();
      if (!stored) {
        await this.endLocally(error);
        throw error;
      }
      await this.refreshShared(stored);
      try {
        return await this.api.request<T>(path, { ...options, accessToken: this.accessToken });
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          await this.endLocally(retryError);
        }
        throw retryError;
      }
    }
  }

  // ---- internals ----
  private refreshShared(refreshToken: string): Promise<void> {
    // Single flight: every caller waiting on a refresh gets the same result.
    this.refreshing ??= this.refreshTokens(refreshToken)
      .catch(async error => {
        if (this.isSessionRejection(error)) {
          await this.endLocally(error);
        }
        throw error;
      })
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  private async refreshTokens(refreshToken: string): Promise<void> {
    const tokens = await this.api.request<AccessTokens>('/auth/token/refresh', {
      method: 'POST',
      body: { refreshToken, client: 'MOBILE' },
    });
    if (!tokens.refreshToken) {
      throw new ApiError('INVALID_RESPONSE', 'Phản hồi từ dịch vụ chưa hợp lệ.');
    }
    // The server already rotated the token: persist the new one before anything else.
    await this.storage.set(tokens.refreshToken);
    this.accessToken = tokens.accessToken;
  }

  /** True when the server says this session is over (not merely a network hiccup). */
  private isSessionRejection(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      (error.status === 401 || error.code === 'ACCOUNT_SUSPENDED' || error.code === 'TOKEN_REUSED')
    );
  }

  private async endLocally(error: unknown) {
    await this.clear();
    const suspended = error instanceof ApiError && error.code === 'ACCOUNT_SUSPENDED';
    this.setState({ status: 'guest', endedReason: suspended ? 'suspended' : 'expired' });
  }

  private async clear() {
    this.accessToken = undefined;
    await this.storage.clear();
  }
}
