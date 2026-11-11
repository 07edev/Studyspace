import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { UserAdminDetail } from '@contracts/admin';
import { ApiError } from '../../lib/api';
import { queryKeys, useApiQuery } from '../../lib/query';
import { ErrorState, LoadingState, Modal, useToast } from '../../ui';
import { UserSummary } from './UserSummary';

// A06 - Xem nhanh nguoi dung. Loads only when opened.
export function UserQuickView({ userId, onClose }: { userId: string; onClose: () => void }) {
  const toast = useToast();
  const query = useApiQuery<UserAdminDetail>(queryKeys.users.detail(userId), `/admin/users/${userId}`);
  const gone = query.error instanceof ApiError && query.error.status === 404;
  useEffect(() => {
    if (gone) {
      toast('Người dùng này không còn tồn tại.', 'error');
      onClose();
    }
  }, [gone, toast, onClose]);

  return (
    <Modal title="Thông tin người dùng" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && !gone && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && (
        <>
          <UserSummary detail={query.data} />
          <div className="modal-actions">
            <Link className="btn" to={`/users/${userId}`} onClick={onClose}>Xem chi tiết</Link>
          </div>
        </>
      )}
    </Modal>
  );
}
