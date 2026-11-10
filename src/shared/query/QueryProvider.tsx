import React, { useEffect, useMemo, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { useSessionManager } from '../auth/AuthProvider';

// Do not retry answers the server already gave (4xx): retrying a 404/422/403 cannot fix it.
// Network failures and 5xx get up to two quiet retries.
export const shouldRetry = (failures: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        // There is no browser tab in a phone app; refresh explicitly (pull to refresh) instead.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });

/**
 * One cache for the whole app. It is wiped whenever the signed-in user changes or signs out, so a
 * second person on the same phone can never see the first person's cached data.
 */
export function QueryProvider({
  client,
  children,
}: PropsWithChildren<{ client?: QueryClient }>) {
  const session = useSessionManager();
  const queryClient = useMemo(() => client ?? createQueryClient(), [client]);
  useEffect(() => {
    let owner = session.getState().user?.id;
    return session.subscribe(() => {
      const next = session.getState().user?.id;
      const previous = owner;
      owner = next;
      // Wipe only when someone who WAS signed in leaves or is replaced. Going from "not known yet"
      // (app start, session restoring) to signed in must not touch queries that are already loading.
      // reset (not clear) so screens still on display reload instead of hanging on a deleted entry.
      if (previous !== undefined && next !== previous) {
        queryClient.resetQueries();
      }
    });
  }, [session, queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
