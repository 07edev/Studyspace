import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { createApiClient } from '../api/client';
import { API_BASE_URL } from '../config';
import { SessionManager, type SessionState } from './sessionManager';
import { keychainTokenStorage } from './tokenStorage';

const SessionContext = createContext<SessionManager | null>(null);

function createDefaultManager() {
  return new SessionManager(
    createApiClient({ baseUrl: API_BASE_URL }),
    keychainTokenStorage,
  );
}

/** Provides the session to the whole app and restores it from secure storage on launch. */
export function AuthProvider({
  manager,
  children,
}: PropsWithChildren<{ manager?: SessionManager }>) {
  const session = useMemo(() => manager ?? createDefaultManager(), [manager]);
  useEffect(() => {
    session.restore();
  }, [session]);
  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  );
}

export function useSessionManager(): SessionManager {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSessionManager must be used inside AuthProvider');
  }
  return value;
}

/** Reactive session state: { status, user?, endedReason? }. */
export function useSession(): SessionState {
  const manager = useSessionManager();
  return useSyncExternalStore(manager.subscribe, manager.getState);
}
