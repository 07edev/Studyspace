import type { Page } from '@contracts/api';
import type { ReactNode } from 'react';
import { Button } from './controls';
import { EmptyState, ErrorState, LoadingState } from './states';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  // Optional fixed width, e.g. '120px'.
  width?: string;
};

type QueryLike<T> = {
  data?: Page<T>;
  isPending: boolean;
  isFetching?: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * Table for server-paged lists (the Page<T> contract). Handles first load, error with retry and
 * the empty list, so screens only describe their columns.
 */
export function DataTable<T>({
  query, columns, rowKey, emptyTitle = 'Chưa có dữ liệu', emptyDescription, page, onPageChange, caption,
}: {
  query: QueryLike<T>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  page: number;
  onPageChange: (page: number) => void;
  caption: string;
}) {
  const { data } = query;
  if (query.isPending) return <LoadingState />;
  if (query.error && !data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div>
      <div className="table-wrap" aria-busy={query.isFetching || undefined}>
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map(row => (
              <tr key={rowKey(row)}>
                {columns.map(c => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pagination={data.pagination} onChange={onPageChange} />
    </div>
  );
}

export function Pagination({
  page, pagination, onChange,
}: { page: number; pagination: Page<unknown>['pagination']; onChange: (page: number) => void }) {
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span className="muted">
        Trang {pagination.page}/{Math.max(1, pagination.totalPages)} · {pagination.total} mục
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" small disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</Button>
        <Button variant="secondary" small disabled={!pagination.hasNext} onClick={() => onChange(page + 1)}>Sau</Button>
      </span>
    </nav>
  );
}
