import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Admin } from '@contracts/admin';
import type { Permission } from '@contracts/api';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query';
import { Button, Modal, ModalCancel, useSubmit, useToast } from '../../ui';
import { PermissionMatrix, samePermissions } from './PermissionMatrix';

// A10 - Phan quyen. The saved list replaces the old one completely.
export function PermissionsModal({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { reloadUser } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>(admin.permissions);
  const submit = useSubmit();
  const changed = !samePermissions(permissions, admin.permissions);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const updated = await submit.run(() =>
      api.request<Admin>(`/admin/admins/${admin.id}/permissions`, { method: 'PUT', body: { permissions } }),
    );
    await queryClient.invalidateQueries({ queryKey: queryKeys.admins.all });
    if (updated) {
      void reloadUser().catch(() => undefined); // keep this person's own menu current
      toast('Đã cập nhật quyền. Có hiệu lực ngay.');
      onClose();
    }
  };

  return (
    <Modal title={`Phân quyền: ${admin.displayName}`} size="L" onClose={onClose} dirty={changed}>
      <form className="form" onSubmit={onSubmit}>
        <p className="muted">Danh sách dưới đây thay thế hoàn toàn quyền hiện có của quản trị viên này.</p>
        <PermissionMatrix value={permissions} onChange={setPermissions} />
        {submit.fields.permissions && <div className="form-error" role="alert">{submit.fields.permissions}</div>}
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" loading={submit.pending} disabled={!changed}>Lưu quyền</Button>
        </div>
      </form>
    </Modal>
  );
}
