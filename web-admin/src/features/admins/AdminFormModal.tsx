import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Admin, AdminCreateBody, AdminCreated, AdminPatchBody, AdminStatus } from '@contracts/admin';
import type { Permission } from '@contracts/api';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query';
import { Button, Checkbox, Modal, ModalCancel, TextField, useConfirm, useSubmit, useToast } from '../../ui';
import { PermissionMatrix, samePermissions } from './PermissionMatrix';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A08 (create, no `admin`) and A09 (edit, with `admin`): name, status and — when creating — the
 * permissions. Permissions of an existing admin are changed in A10 (PermissionsModal).
 */
export function AdminFormModal({
  admin, isSelf = false, onClose,
}: { admin?: Admin; isSelf?: boolean; onClose: () => void }) {
  const editing = admin !== undefined;
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(admin?.displayName ?? '');
  const [email, setEmail] = useState(admin?.email ?? '');
  const [active, setActive] = useState((admin?.status ?? 'ACTIVE') === 'ACTIVE');
  const [permissions, setPermissions] = useState<Permission[]>(admin?.permissions ?? []);
  const [local, setLocal] = useState<Record<string, string>>({});
  const submit = useSubmit();

  const dirty = editing
    ? displayName !== admin.displayName || active !== (admin.status === 'ACTIVE')
    : displayName !== '' || email !== '' || permissions.length > 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.admins.all });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const name = displayName.trim();
    if (name.length < 2 || name.length > 100) errors.displayName = 'Tên hiển thị cần từ 2 đến 100 ký tự.';
    if (!editing && !EMAIL_RE.test(email.trim())) errors.email = 'Email không hợp lệ.';
    setLocal(errors);
    if (Object.keys(errors).length > 0) return;

    if (!editing) {
      const body: AdminCreateBody = { displayName: name, email: email.trim().toLowerCase(), role: 'ADMIN', permissions };
      const created = await submit.run(() => api.request<AdminCreated>('/admin/admins', { method: 'POST', body }));
      if (created) {
        await refresh();
        toast(
          created.invitationSent
            ? `Đã tạo quản trị viên và gửi lời mời tới ${created.email}.`
            : `Đã tạo quản trị viên nhưng chưa gửi được email. Hãy nhờ ${created.email} dùng "Quên mật khẩu" để đặt mật khẩu.`,
          created.invitationSent ? 'info' : 'error',
        );
        onClose();
      }
      return;
    }

    const body: AdminPatchBody = {};
    if (name !== admin.displayName) body.displayName = name;
    const status: AdminStatus = active ? 'ACTIVE' : 'DISABLED';
    if (status !== admin.status) {
      if (status === 'DISABLED' && !(await confirm({
        title: 'Vô hiệu hóa quản trị viên?',
        message: `${admin.displayName} sẽ bị đăng xuất và không thể vào trang quản trị cho tới khi được bật lại.`,
        confirmLabel: 'Vô hiệu hóa',
        destructive: true,
      }))) {
        return;
      }
      body.status = status;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    const updated = await submit.run(() =>
      api.request<Admin>(`/admin/admins/${admin.id}`, { method: 'PATCH', body }),
    );
    // A 409 means someone else changed it first: reload so the list shows the real state.
    await refresh();
    if (updated) {
      toast('Đã lưu thay đổi.');
      onClose();
    }
  };

  return (
    <Modal title={editing ? 'Chỉnh sửa quản trị viên' : 'Thêm quản trị viên'} size="L" onClose={onClose} dirty={dirty}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label="Tên hiển thị" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100}
          error={local.displayName ?? submit.fields.displayName} data-autofocus
        />
        <TextField
          label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
          readOnly={editing} disabled={editing}
          hint={editing ? 'Không thể đổi email của quản trị viên.' : 'Lời mời sẽ được gửi tới email này. Email không chứa mật khẩu.'}
          error={local.email ?? submit.fields.email}
        />
        {editing ? (
          <Checkbox
            label="Đang hoạt động" checked={active} onChange={e => setActive(e.target.checked)}
            disabled={isSelf}
          />
        ) : (
          <div className="field">
            <span className="label">Quyền</span>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
            {submit.fields.permissions && <span className="error-text" role="alert">{submit.fields.permissions}</span>}
            {samePermissions(permissions, []) && (
              <span className="hint">Chưa chọn quyền nào: tài khoản sẽ vào được trang quản trị nhưng chưa thấy mục nào.</span>
            )}
          </div>
        )}
        {isSelf && editing && <p className="hint">Bạn không thể tự vô hiệu hóa tài khoản của mình.</p>}
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" loading={submit.pending}>{editing ? 'Lưu' : 'Tạo và gửi lời mời'}</Button>
        </div>
      </form>
    </Modal>
  );
}
