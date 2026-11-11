import { useState } from 'react';
import type { AuditEntry } from '@contracts/admin';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery } from '../../lib/query';
import { Badge, Button, ErrorState, LoadingState, Modal } from '../../ui';
import { ACTOR_TYPE_LABEL, actionLabel, actorName, diffRows, formatValue, resourceTypeLabel, REDACTED } from './audit';

export type AuditFilterShortcut = { actorId?: string; resourceId?: string; requestId?: string };

// A50 - Chi tiet nhat ky. Loads the entry when opened.
export function AuditDetailModal({
  auditId, onClose, onFilter,
}: { auditId: string; onClose: () => void; onFilter: (filter: AuditFilterShortcut) => void }) {
  const [comparing, setComparing] = useState(false);
  const query = useApiQuery<AuditEntry>(queryKeys.audit.detail(auditId), `/admin/audit-logs/${auditId}`);
  const entry = query.data;

  if (comparing && entry) return <AuditCompareModal entry={entry} onClose={() => setComparing(false)} />;
  return (
    <Modal title="Chi tiết nhật ký" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {entry && (
        <>
          <dl className="facts">
            <dt>Thời gian</dt><dd>{formatDateTime(entry.createdAt)}</dd>
            <dt>Hành động</dt><dd><strong>{actionLabel(entry.action)}</strong> <span className="muted">({entry.action})</span></dd>
            <dt>Người thực hiện</dt>
            <dd>
              {actorName(entry)} <Badge tone="neutral">{ACTOR_TYPE_LABEL[entry.actorType]}</Badge>
              {entry.actor?.email && entry.actor.displayName && <div className="muted">{entry.actor.email}</div>}
            </dd>
            <dt>Đối tượng</dt>
            <dd>{resourceTypeLabel(entry.resourceType)}{entry.resourceId && <span className="muted"> · {entry.resourceId}</span>}</dd>
            <dt>Mã yêu cầu</dt><dd>{entry.requestId}</dd>
            <dt>Kết quả</dt><dd>{summary(entry)}</dd>
          </dl>
          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            {entry.actorId && <Button variant="secondary" small onClick={() => onFilter({ actorId: entry.actorId })}>Mọi việc của người này</Button>}
            {entry.resourceId && <Button variant="secondary" small onClick={() => onFilter({ resourceId: entry.resourceId })}>Mọi thay đổi của đối tượng này</Button>}
            <Button variant="secondary" small onClick={() => onFilter({ requestId: entry.requestId })}>Cùng yêu cầu</Button>
          </div>
          <div className="modal-actions">
            {(entry.before || entry.after) && <Button variant="secondary" onClick={() => setComparing(true)}>So sánh trước/sau</Button>}
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// One line saying what happened, from the recorded values.
function summary(entry: AuditEntry): string {
  const { before, after } = entry;
  if (typeof before?.status === 'string' && typeof after?.status === 'string') {
    const reason = typeof after.reason === 'string' ? `. Lý do: ${after.reason}` : '';
    return `Trạng thái ${before.status} → ${after.status}${reason}`;
  }
  const changed = diffRows(before, after).filter(row => row.changed).map(row => row.field);
  return changed.length > 0 ? `Thay đổi: ${changed.join(', ')}` : 'Đã ghi nhận.';
}

// A51 - So sanh truoc/sau. Values were redacted when written; secrets show as "(đã ẩn)".
function AuditCompareModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const rows = diffRows(entry.before, entry.after);
  const hidden = rows.some(row => row.before === REDACTED || row.after === REDACTED);
  return (
    <Modal title="So sánh trước/sau" size="L" onClose={onClose}>
      <p className="muted">{actionLabel(entry.action)} · {formatDateTime(entry.createdAt)}</p>
      {rows.length === 0 ? (
        <p>Bản ghi này không lưu giá trị trước/sau.</p>
      ) : (
        <div className="table-wrap">
          <table className="table diff-table">
            <caption className="sr-only">So sánh giá trị trước và sau</caption>
            <thead><tr><th scope="col">Trường</th><th scope="col">Trước</th><th scope="col">Sau</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.field} className={row.changed ? 'diff-changed' : undefined}>
                  <th scope="row">{row.field}{row.changed && <span className="sr-only"> (đã thay đổi)</span>}</th>
                  <td><code>{formatValue(row.before)}</code></td>
                  <td><code>{formatValue(row.after)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hidden && <p className="hint">Dữ liệu nhạy cảm (mật khẩu, mã, token…) được ẩn từ lúc ghi nhật ký.</p>}
      <details>
        <summary>Xem JSON gốc</summary>
        <pre className="json-box">{JSON.stringify({ before: entry.before ?? null, after: entry.after ?? null }, null, 2)}</pre>
      </details>
      <div className="modal-actions"><Button onClick={onClose}>Đóng</Button></div>
    </Modal>
  );
}
