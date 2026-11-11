import { useState } from 'react';
import type { AuditEvent } from '@contracts/admin';
import { formatDateTime } from '../../lib/format';
import { usePagedQuery } from '../../lib/query';
import { Button, EmptyState, ErrorState, LoadingState, Modal, Pagination } from '../../ui';

const ACTION_LABEL: Record<string, string> = {
  USER_SUSPENDED: 'Khóa tài khoản',
  USER_UNSUSPENDED: 'Mở khóa tài khoản',
};

type Tab = 'violations' | 'activity';
const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'violations', label: 'Lịch sử xử lý', empty: 'Chưa có lần xử lý nào với tài khoản này.' },
  { id: 'activity', label: 'Hoạt động', empty: 'Chưa ghi nhận hoạt động nào.' },
];

// A07 - Chi tiet vi pham / lich su xu ly. The list of the open tab loads when the tab is shown.
export function ViolationsModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('violations');
  return (
    <Modal title="Lịch sử xử lý và hoạt động" size="L" onClose={onClose}>
      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <Timeline key={tab} userId={userId} kind={tab} empty={TABS.find(t => t.id === tab)!.empty} />
      <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Đóng</Button></div>
    </Modal>
  );
}

function Timeline({ userId, kind, empty }: { userId: string; kind: Tab; empty: string }) {
  const query = usePagedQuery<AuditEvent>(['users', kind, userId], `/admin/users/${userId}/${kind}`, {}, 10);
  if (query.isPending) return <LoadingState />;
  if (query.error && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || query.data.items.length === 0) return <EmptyState title={empty} />;
  return (
    <div>
      <ol className="timeline">
        {query.data.items.map(event => {
          const reason = typeof event.after?.reason === 'string' ? event.after.reason : undefined;
          return (
            <li key={event.id}>
              <strong>{ACTION_LABEL[event.action] ?? event.action}</strong>
              <span className="muted"> · {formatDateTime(event.createdAt)}</span>
              {reason && <p>Lý do: {reason}</p>}
              <p className="hint">
                {event.actorType === 'ADMIN' && event.actorId ? `Bởi quản trị viên ${event.actorId.slice(-6)} · ` : ''}
                Mã yêu cầu: {event.requestId}
              </p>
            </li>
          );
        })}
      </ol>
      <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
    </div>
  );
}
