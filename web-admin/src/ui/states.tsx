import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { Button } from './controls';

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="spinner" aria-hidden />
      <span className="muted">{label}</span>
    </span>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="table-state">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="table-state">
      <h2>{title}</h2>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}

// Friendly text for any failure; shows the request id so support can find it in the server log.
export function ErrorState({
  error, onRetry, title = 'Chưa tải được dữ liệu',
}: { error: unknown; onRetry?: () => void; title?: string }) {
  const known = error instanceof ApiError ? error : undefined;
  return (
    <div className="table-state" role="alert">
      <h2>{title}</h2>
      <p className="muted">{known?.message ?? 'Đã xảy ra lỗi. Vui lòng thử lại.'}</p>
      {known?.requestId && <p className="hint">Mã yêu cầu: {known.requestId}</p>}
      {onRetry && <Button variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}
