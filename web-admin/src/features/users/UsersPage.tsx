import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserView } from '@contracts/admin';
import { useAdmin } from '../../auth/AuthProvider';
import { PermissionGate } from '../../auth/guards';
import { formatDateTime, ROLE_LABEL, STATUS_LABEL, STATUS_TONE, useDebounced } from '../../lib/format';
import { queryKeys, usePagedQuery } from '../../lib/query';
import { Badge, Button, Card, DataTable, PageHeader, SelectField, TextField, type Column } from '../../ui';
import { canChangeStatus } from './userActions';
import { UserQuickView } from './UserQuickView';
import { UserStatusDialog } from './UserStatusDialog';

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

type Modal = { kind: 'view' | 'status'; user: AdminUserView };

// ADM-03 - Danh sach nguoi dung (+ A04/A05 khoa/mo khoa, A06 xem nhanh)
export function UsersPage() {
  const viewer = useAdmin();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [modal, setModal] = useState<Modal>();
  const q = useDebounced(search.trim());
  const filters = { q, status, role };
  const list = usePagedQuery<AdminUserView>(queryKeys.users.list(filters), '/admin/users', filters);
  const filtered = q !== '' || status !== '' || role !== '';

  const columns: Column<AdminUserView>[] = [
    {
      key: 'user', header: 'Người dùng',
      render: u => (
        <div>
          <strong>{u.profile.displayName ?? '(chưa đặt tên)'}</strong>
          <div className="muted">{u.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Vai trò', render: u => <Badge tone={u.role === 'USER' ? 'neutral' : 'info'}>{ROLE_LABEL[u.role]}</Badge> },
    { key: 'status', header: 'Trạng thái', render: u => <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge> },
    { key: 'created', header: 'Ngày tạo', render: u => formatDateTime(u.createdAt) },
    { key: 'login', header: 'Đăng nhập gần nhất', render: u => formatDateTime(u.lastLoginAt) },
    {
      key: 'actions', header: '',
      render: u => (
        <div className="row-actions">
          <Button variant="secondary" small onClick={() => setModal({ kind: 'view', user: u })} aria-label={`Xem nhanh ${u.email}`}>
            Xem
          </Button>
          <Link className="btn btn-secondary btn-sm" to={`/users/${u.id}`} aria-label={`Chi tiết ${u.email}`}>Chi tiết</Link>
          <PermissionGate access={{ module: 'USERS', action: 'UPDATE' }}>
            {canChangeStatus(viewer, u) && (
              <Button
                variant={u.status === 'SUSPENDED' ? 'secondary' : 'danger'} small
                onClick={() => setModal({ kind: 'status', user: u })}
                aria-label={`${u.status === 'SUSPENDED' ? 'Mở khóa' : 'Khóa'} ${u.email}`}
              >
                {u.status === 'SUSPENDED' ? 'Mở khóa' : 'Khóa'}
              </Button>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader title="Người dùng" description="Tìm kiếm, xem và khóa hoặc mở khóa tài khoản." />
      <Card>
        <div className="toolbar" role="search">
          <TextField label="Tìm kiếm" placeholder="Email, tên hoặc mã người dùng" value={search} onChange={e => setSearch(e.target.value)} maxLength={100} />
          <SelectField label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)} options={STATUS_OPTIONS} placeholder="Tất cả" />
          <SelectField label="Vai trò" value={role} onChange={e => setRole(e.target.value)} options={ROLE_OPTIONS} placeholder="Tất cả" />
          {filtered && (
            <Button variant="ghost" onClick={() => { setSearch(''); setStatus(''); setRole(''); }}>Xóa bộ lọc</Button>
          )}
        </div>
      </Card>
      <DataTable
        query={list} columns={columns} rowKey={u => u.id} page={list.page} onPageChange={list.setPage}
        caption="Danh sách người dùng"
        emptyTitle={filtered ? 'Không có người dùng phù hợp' : 'Chưa có người dùng'}
        emptyDescription={filtered ? 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc.' : undefined}
      />
      {modal?.kind === 'view' && <UserQuickView userId={modal.user.id} onClose={() => setModal(undefined)} />}
      {modal?.kind === 'status' && <UserStatusDialog user={modal.user} onClose={() => setModal(undefined)} />}
    </div>
  );
}
