import { useQueryClient } from '@tanstack/react-query';
import type { Admin } from '@contracts/admin';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query';
import { Button, Modal, useSubmit, useToast, ModalCancel } from '../../ui';

// A11 - Go quyen quan tri. The account stays as a normal user; only admin access is removed.
export function RemoveAdminDialog({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();

  const onConfirm = async () => {
    const done = await submit.run(async () => {
      await api.request(`/admin/admins/${admin.id}`, { method: 'DELETE' });
      return true;
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.admins.all });
    if (done) {
      toast('Đã gỡ quyền quản trị.');
      onClose();
    }
  };

  return (
    <Modal title="Gỡ quyền quản trị?" size="C" onClose={onClose}>
      <p>
        <strong>{admin.displayName}</strong> ({admin.email}) sẽ bị đăng xuất khỏi trang quản trị và không còn quyền quản trị.
        Tài khoản vẫn tồn tại như một người dùng thông thường.
      </p>
      {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
      <div className="modal-actions">
        <ModalCancel />
        <Button variant="danger" onClick={onConfirm} loading={submit.pending}>Gỡ quyền</Button>
      </div>
    </Modal>
  );
}
