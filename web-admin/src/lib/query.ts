import type { Page } from '@contracts/api';
import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from './api';

// Do not retry answers the server already gave (4xx). Network failures and 5xx get two quiet retries.
export const shouldRetry = (failures: number, error: unknown) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });

/**
 * Query keys are `[domain, resource, ...params]`; pass filters as ONE object, e.g.
 * `queryKeys.users.list({ q, status })`. Add your own domain here.
 */
export const queryKeys = {
  users: {
    all: ['users'] as const,
    list: (filters: object) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  admins: {
    all: ['admins'] as const,
    list: (filters: object) => ['admins', 'list', filters] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (filters: object) => ['audit', 'list', filters] as const,
    detail: (id: string) => ['audit', 'detail', id] as const,
  },
  // Dashboard and statistics. After a moderation action (approve, hide, resolve...) call
  // queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }) so the numbers refresh.
  stats: {
    all: ['stats'] as const,
    dashboard: (days: number) => ['stats', 'dashboard', days] as const,
    activity: (params: object) => ['stats', 'activity', params] as const,
  },
};

type Params = Record<string, string | number | boolean | undefined>;

/** One resource. Use `usePagedQuery` for lists. Never call fetch directly in a page. */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  // keepPrevious: while the key changes (a new filter), keep showing the last result instead of
  // blanking the screen; `isPlaceholderData` tells the page it is out of date.
  options: { query?: Params; enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: ({ signal }) => api.request<T>(path, { query: options.query, signal }),
    enabled: options.enabled,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

/**
 * A server-paged list (Page<T>). Changing the filters goes back to page 1, and the previous page
 * stays on screen while the next one loads, so the table does not flash.
 */
export function usePagedQuery<T>(
  key: readonly unknown[],
  path: string,
  filters: Params = {},
  limit = 20,
) {
  const signature = JSON.stringify(filters);
  const [position, setPosition] = useState({ signature, page: 1 });
  const page = position.signature === signature ? position.page : 1;
  const query = useQuery<Page<T>, ApiError>({
    queryKey: [...key, { page, limit }],
    queryFn: ({ signal }) => api.request<Page<T>>(path, { query: { ...filters, page, limit }, signal }),
    placeholderData: keepPreviousData,
  });
  return { ...query, page, setPage: (next: number) => setPosition({ signature, page: next }) };
}
