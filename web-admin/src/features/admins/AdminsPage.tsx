import { useState } from 'react';
import type { Admin } from '@contracts/admin';
import { useAdmin } from '../../auth/AuthProvider';
import { formatDateTime } from '../../lib/format';
import { queryKeys, usePagedQuery } from '../../lib/query';
import { Badge, Button, DataTable, PageHeader, type Column } from '../../ui';
import { AdminFormModal } from './AdminFormModal';
import { summarize } from './PermissionMatrix';
import { PermissionsModal } from './PermissionsModal';
import { RemoveAdminDialog } from './RemoveAdminDialog';

type Modal = { kind: 'create' } | { kind: 'edit' | 'permissions' | 'remove'; admin: Admin };

// ADM-05 - Quan ly Admin (Super Admin only; the route is gated in the registry)
export function AdminsPage() {
  const me = useAdmin();
  const [modal, setModal] = useState<Modal>();
  const list = usePagedQuery<Admin>(queryKeys.admins.list({}), '/admin/admins');

  const columns: Column<Admin>[] = [
    {
      key: 'name', header: 'Quản trị viên',
      render: a => (
        <div>
          <strong>{a.displayName}</strong>{a.id === me.id && <span className="muted"> (bạn)</span>}
          <div className="muted">{a.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Vai trò', render: a => <Badge tone={a.role === 'SUPER_ADMIN' ? 'success' : 'info'}>{a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</Badge> },
    { key: 'status', header: 'Trạng thái', render: a => <Badge tone={a.status === 'ACTIVE' ? 'success' : 'neutral'}>{a.status === 'ACTIVE' ? 'Hoạt động' : 'Đã vô hiệu hóa'}</Badge> },
    { key: 'perms', header: 'Quyền', render: a => (a.role === 'SUPER_ADMIN' ? 'Toàn quyền' : summarize(a.permissions)) },
    { key: 'login', header: 'Đăng nhập gần nhất', render: a => formatDateTime(a.lastLoginAt) },
    {
      key: 'actions', header: '',
      render: a => {
        const self = a.id === me.id;
        const isSuper = a.role === 'SUPER_ADMIN';
        return (
          <div className="row-actions">
            <Button variant="secondary" small onClick={() => setModal({ kind: 'edit', admin: a })} aria-label={`Sửa ${a.email}`}>Sửa</Button>
            {!isSuper && (
              <Button variant="secondary" small onClick={() => setModal({ kind: 'permissions', admin: a })} aria-label={`Phân quyền ${a.email}`}>Phân quyền</Button>
            )}
            {!self && (
              <Button variant="danger" small onClick={() => setModal({ kind: 'remove', admin: a })} aria-label={`Gỡ quyền ${a.email}`}>Gỡ quyền</Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Quản lý Admin"
        description="Mời quản trị viên, chọn quyền và vô hiệu hóa khi cần."
        actions={<Button onClick={() => setModal({ kind: 'create' })}>Thêm Admin</Button>}
      />
      <DataTable
        query={list} columns={columns} rowKey={a => a.id} page={list.page} onPageChange={list.setPage}
        caption="Danh sách quản trị viên" emptyTitle="Chưa có quản trị viên"
      />
      {modal?.kind === 'create' && <AdminFormModal onClose={() => setModal(undefined)} />}
      {modal?.kind === 'edit' && <AdminFormModal admin={modal.admin} isSelf={modal.admin.id === me.id} onClose={() => setModal(undefined)} />}
      {modal?.kind === 'permissions' && <PermissionsModal admin={modal.admin} onClose={() => setModal(undefined)} />}
      {modal?.kind === 'remove' && <RemoveAdminDialog admin={modal.admin} onClose={() => setModal(undefined)} />}
    </div>
  );
}
