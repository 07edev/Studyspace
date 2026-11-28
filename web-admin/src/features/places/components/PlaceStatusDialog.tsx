import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Place, PlaceStatusPatch } from '@contracts/places';
import { api } from '../../../lib/api';
import { queryKeys } from '../../../lib/query';
import { Button, Modal, ModalCancel, TextArea, useSubmit, useToast } from '../../../ui';

const MIN_REASON = 10;

export type PlaceStatusAction = 'PUBLISHED' | 'HIDDEN' | 'DELETED';

const META: Record<PlaceStatusAction, { title: string; button: string; description: (name: string) => string; success: string; danger: boolean }> = {
  PUBLISHED: {
    title: 'Xuất bản địa điểm',
    button: 'Xuất bản',
    description: name => `Địa điểm "${name}" sẽ hiển thị công khai trên ứng dụng người dùng.`,
    success: 'Đã xuất bản địa điểm.',
    danger: false,
  },
  HIDDEN: {
    title: 'Ẩn địa điểm',
    button: 'Ẩn địa điểm',
    description: name => `Địa điểm "${name}" sẽ tạm ẩn khỏi kết quả tìm kiếm công khai cho tới khi xuất bản lại.`,
    success: 'Đã ẩn địa điểm.',
    danger: true,
  },
  DELETED: {
    title: 'Xóa mềm địa điểm',
    button: 'Xác nhận xóa',
    description: name => `Địa điểm "${name}" sẽ chuyển sang trạng thái Đã xóa và không hiển thị công khai. Lịch sử vẫn được lưu.`,
    success: 'Đã xóa mềm địa điểm.',
    danger: true,
  },
};

// A13 (Xuat ban / An) & A14 (Xoa mem)
export function PlaceStatusDialog({
  place,
  targetStatus,
  onClose,
  onDone,
}: {
  place: Pick<Place, 'id' | 'name' | 'status'>;
  targetStatus: PlaceStatusAction;
  onClose: () => void;
  onDone?: (updated: Place) => void;
}) {
  const meta = META[targetStatus];
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string>();
  const submit = useSubmit();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setLocalError(`Lý do cần tối thiểu ${MIN_REASON} ký tự.`);
      return;
    }
    setLocalError(undefined);
    const body: PlaceStatusPatch = { status: targetStatus, reason: reason.trim() };
    const updated = await submit.run(() =>
      api.request<Place>(`/admin/places/${place.id}/status`, { method: 'PATCH', body }),
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
    ]);
    if (updated) {
      toast(meta.success);
      onDone?.(updated);
      onClose();
    }
  };

  return (
    <Modal title={meta.title} size="C" onClose={onClose} dirty={reason !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <p>{meta.description(place.name)}</p>
        <TextArea
          label="Lý do thực hiện"
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={1000}
          hint={`Tối thiểu ${MIN_REASON} ký tự. Ghi nhận vào nhật ký quản trị.`}
          error={localError ?? submit.fields.reason}
          data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" variant={meta.danger ? 'danger' : 'primary'} loading={submit.pending}>
            {meta.button}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
