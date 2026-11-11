import { useState } from 'react';
import type { AuditEntry } from '@contracts/admin';
import { formatDateTime, useDebounced } from '../../lib/format';
import { queryKeys, usePagedQuery } from '../../lib/query';
import { Badge, Button, Card, DataTable, PageHeader, SelectField, TextField, type Column } from '../../ui';
import { ACTOR_TYPE_LABEL, actionLabel, actorName, RESOURCE_TYPE_LABEL, resourceTypeLabel, shortId } from './audit';
import { AuditDetailModal, type AuditFilterShortcut } from './AuditDialogs';

const RESOURCE_OPTIONS = Object.entries(RESOURCE_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const ACTOR_OPTIONS = Object.entries(ACTOR_TYPE_LABEL).map(([value, label]) => ({ value, label }));

// Dates are picked as Vietnam calendar days; the server takes instants.
const startOfDay = (day: string) => (day ? `${day}T00:00:00+07:00` : '');
const endOfDay = (day: string) => (day ? `${day}T23:59:59.999+07:00` : '');

// ADM-25 - Nhat ky quan tri
export function AuditPage() {
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [actorType, setActorType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shortcut, setShortcut] = useState<AuditFilterShortcut>({});
  const [openId, setOpenId] = useState<string>();
  const reversed = from !== '' && to !== '' && from > to;
  const debouncedAction = useDebounced(action.trim());

  const filters = {
    action: debouncedAction, resourceType, actorType,
    from: startOfDay(from), to: reversed ? '' : endOfDay(to), ...shortcut,
  };
  const list = usePagedQuery<AuditEntry>(queryKeys.audit.list(filters), '/admin/audit-logs', filters);
  const filtered = Object.values(filters).some(Boolean);
  const reset = () => {
    setAction(''); setResourceType(''); setActorType(''); setFrom(''); setTo(''); setShortcut({});
  };

  const columns: Column<AuditEntry>[] = [
    { key: 'time', header: 'Thời gian', render: e => formatDateTime(e.createdAt) },
    {
      key: 'actor', header: 'Người thực hiện',
      render: e => (
        <div>
          {actorName(e)}
          <div className="muted">{ACTOR_TYPE_LABEL[e.actorType]}</div>
        </div>
      ),
    },
    {
      key: 'action', header: 'Hành động',
      render: e => (
        <div>
          <strong>{actionLabel(e.action)}</strong>
          {actionLabel(e.action) !== e.action && <div className="muted">{e.action}</div>}
        </div>
      ),
    },
    {
      key: 'resource', header: 'Đối tượng',
      render: e => (
        <div>
          {resourceTypeLabel(e.resourceType)}
          {e.resourceId && <div className="muted">…{shortId(e.resourceId)}</div>}
        </div>
      ),
    },
    {
      key: 'open', header: '',
      render: e => (
        <Button variant="secondary" small onClick={() => setOpenId(e.id)} aria-label={`Xem chi tiết ${actionLabel(e.action)} lúc ${formatDateTime(e.createdAt)}`}>
          Xem
        </Button>
      ),
    },
  ];

  const chips: { key: keyof AuditFilterShortcut; label: string }[] = [
    { key: 'actorId', label: 'Người thực hiện' },
    { key: 'resourceId', label: 'Đối tượng' },
    { key: 'requestId', label: 'Mã yêu cầu' },
  ];

  return (
    <div className="page">
      <PageHeader title="Nhật ký quản trị" description="Mọi thao tác quản trị được ghi lại, chỉ thêm, không sửa hoặc xóa được. Dữ liệu nhạy cảm đã được ẩn." />
      <Card>
        <div className="toolbar" role="search">
          <TextField label="Hành động" placeholder="Ví dụ: suspended" value={action} onChange={e => setAction(e.target.value)} maxLength={120} />
          <SelectField label="Đối tượng" value={resourceType} onChange={e => setResourceType(e.target.value)} options={RESOURCE_OPTIONS} placeholder="Tất cả" />
          <SelectField label="Người thực hiện" value={actorType} onChange={e => setActorType(e.target.value)} options={ACTOR_OPTIONS} placeholder="Tất cả" />
          <TextField label="Từ ngày" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <TextField label="Đến ngày" type="date" value={to} onChange={e => setTo(e.target.value)} error={reversed ? 'Phải sau hoặc bằng ngày bắt đầu.' : undefined} />
          {filtered && <Button variant="ghost" onClick={reset}>Xóa bộ lọc</Button>}
        </div>
        {chips.some(c => shortcut[c.key]) && (
          <div className="toolbar" style={{ marginTop: 12 }}>
            {chips.filter(c => shortcut[c.key]).map(c => (
              <Badge key={c.key} tone="info">
                {c.label}: …{shortId(shortcut[c.key])}{' '}
                <button type="button" className="icon-btn" aria-label={`Bỏ lọc ${c.label}`} onClick={() => setShortcut(s => ({ ...s, [c.key]: undefined }))}>✕</button>
              </Badge>
            ))}
          </div>
        )}
      </Card>
      <DataTable
        query={list} columns={columns} rowKey={e => e.id} page={list.page} onPageChange={list.setPage}
        caption="Nhật ký quản trị"
        emptyTitle={filtered ? 'Không có bản ghi phù hợp' : 'Chưa có bản ghi nào'}
        emptyDescription={filtered ? 'Thử bỏ bớt bộ lọc.' : undefined}
      />
      {openId && (
        <AuditDetailModal
          auditId={openId}
          onClose={() => setOpenId(undefined)}
          onFilter={next => { setShortcut(next); setOpenId(undefined); }}
        />
      )}
    </div>
  );
}
