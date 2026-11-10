import {
  useInfiniteQuery,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { useSessionManager } from '../auth/AuthProvider';
import type { Page } from '../contracts/api';
import { withQuery, type QueryKey } from './queryKeys';

type Common = {
  // Set false while a required id is not known yet.
  enabled?: boolean;
  // Public endpoints (no login needed) must say so; by default the signed-in session is used.
  authenticated?: boolean;
  staleTime?: number;
};

/** GET `path` and cache the result under `key` (see queryKeys.ts). Errors are `ApiError`. */
export function useApiQuery<T>(
  key: QueryKey,
  path: string,
  { enabled = true, authenticated = true, staleTime }: Common = {},
): UseQueryResult<T, ApiError> {
  const session = useSessionManager();
  return useQuery<T, ApiError>({
    queryKey: key,
    enabled,
    staleTime,
    queryFn: ({ signal }) =>
      authenticated
        ? session.request<T>(path, { signal })
        : session.publicRequest<T>(path, { signal }),
  });
}

export type PagedQuery<T> = {
  items: T[];
  status: 'loading' | 'error' | 'success';
  error: ApiError | null;
  total: number | undefined;
  hasNext: boolean;
  isRefreshing: boolean;
  isFetchingNext: boolean;
  // Loading the NEXT page failed (the pages already shown are still fine).
  nextFailed: boolean;
  fetchNext: () => void;
  refresh: () => void;
  retry: () => void;
};

/**
 * Paged GET following the G1 `Page<T>` contract ({ items, pagination: { page, hasNext, ... } }).
 * `params` are sent as the query string together with `page` and `limit`.
 */
export function usePagedQuery<T>(
  key: QueryKey,
  path: string,
  params: Record<string, unknown> = {},
  { enabled = true, authenticated = true, limit = 20 }: Common & { limit?: number } = {},
): PagedQuery<T> {
  const session = useSessionManager();
  const query = useInfiniteQuery<Page<T>, ApiError, { pages: Page<T>[] }, QueryKey, number>({
    queryKey: [...key, { limit }],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const url = withQuery(path, { ...params, page: pageParam, limit });
      return authenticated
        ? session.request<Page<T>>(url, { signal })
        : session.publicRequest<Page<T>>(url, { signal });
    },
    getNextPageParam: last => (last.pagination.hasNext ? last.pagination.page + 1 : undefined),
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap(page => page.items),
    status: query.isPending ? 'loading' : query.isError && pages.length === 0 ? 'error' : 'success',
    error: query.error,
    total: pages[0]?.pagination.total,
    hasNext: !!query.hasNextPage,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isFetchingNext: query.isFetchingNextPage,
    nextFailed: query.isFetchNextPageError,
    fetchNext: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
    refresh: () => {
      query.refetch();
    },
    retry: () => {
      query.refetch();
    },
  };
}
