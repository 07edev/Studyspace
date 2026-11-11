import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminUserStatusBody, AdminUserView } from '@contracts/admin';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query';
import { Button, Modal, TextArea, useSubmit, useToast, ModalCancel } from '../../ui';

export const MIN_REASON = 10;

/**
 * A04 (suspend) / A05 (unsuspend): the action follows the account's current state.
 * Exported so TV3's "xử lý tài khoản liên quan" (A48) can reuse it instead of re-implementing it.
 */
export function UserStatusDialog({
  user, onClose, onDone,
}: { user: AdminUserView; onClose: () => void; onDone?: (updated: AdminUserView) => void }) {
  const suspend = user.status !== 'SUSPENDED';
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState<string>();
  const submit = useSubmit();
  const name = user.profile.displayName ?? user.email;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setLocal(`Lý do cần tối thiểu ${MIN_REASON} ký tự.`);
      return;
    }
    setLocal(undefined);
    const body: AdminUserStatusBody = { action: suspend ? 'SUSPEND' : 'UNSUSPEND', reason: reason.trim() };
    const updated = await submit.run(() =>
      api.request<AdminUserView>(`/admin/users/${user.id}/status`, { method: 'PATCH', body }),
    );
    // Success or a 409 ("someone else already changed it"): either way show the real state.
    await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    if (updated) {
      toast(suspend ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      onDone?.(updated);
      onClose();
    }
  };

  return (
    <Modal title={suspend ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} size="C" onClose={onClose} dirty={reason !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <p>
          {suspend
            ? `${name} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho tới khi được mở khóa.`
            : `${name} sẽ có thể đăng nhập trở lại.`}
        </p>
        <TextArea
          label="Lý do" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000}
          hint={`Tối thiểu ${MIN_REASON} ký tự. Lý do được lưu trong nhật ký quản trị.`}
          error={local ?? submit.fields.reason} data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" variant={suspend ? 'danger' : 'primary'} loading={submit.pending}>
            {suspend ? 'Khóa tài khoản' : 'Mở khóa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
