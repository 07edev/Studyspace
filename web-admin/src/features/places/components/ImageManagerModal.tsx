import { useState } from 'react';
import type { ImageRef } from '@contracts/places';
import { Badge, Button, EmptyState, Modal, ModalCancel, TextField } from '../../../ui';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

// A21 - Quan ly anh dia diem (chon anh bia, sap xep, them/xoa fileId)
export function ImageManagerModal({
  images,
  imageFileIds,
  coverFileId,
  onSave,
  onClose,
}: {
  images: ImageRef[];
  imageFileIds: string[];
  coverFileId?: string;
  onSave: (next: { imageFileIds: string[]; coverFileId?: string }) => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState<string[]>(imageFileIds);
  const [cover, setCover] = useState<string | undefined>(coverFileId ?? imageFileIds[0]);
  const [inputId, setInputId] = useState('');
  const [error, setError] = useState<string>();
  const urlById = new Map(images.map(img => [img.fileId, img.url]));
  const dirty = JSON.stringify(ids) !== JSON.stringify(imageFileIds) || cover !== (coverFileId ?? imageFileIds[0]);

  const addFileId = () => {
    const trimmed = inputId.trim();
    if (!OBJECT_ID.test(trimmed)) {
      setError('Mã tệp (fileId) phải là 24 ký tự hex hợp lệ từ dịch vụ Files.');
      return;
    }
    if (ids.includes(trimmed)) {
      setError('Mã tệp này đã có trong danh sách.');
      return;
    }
    if (ids.length >= 20) {
      setError('Tối đa 20 ảnh cho mỗi địa điểm.');
      return;
    }
    setError(undefined);
    const next = [...ids, trimmed];
    setIds(next);
    if (!cover) setCover(trimmed);
    setInputId('');
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const copy = [...ids];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setIds(copy);
  };

  const remove = (id: string) => {
    const next = ids.filter(x => x !== id);
    setIds(next);
    if (cover === id) setCover(next[0]);
  };

  return (
    <Modal title="Quản lý hình ảnh địa điểm" size="L" onClose={onClose} dirty={dirty}>
      <div className="banner-info">
        Lưu ý: Tải lên ảnh mới qua dịch vụ Files (TV3) để nhận <code>fileId</code>. Tại đây bạn có thể sắp xếp thứ tự, chọn ảnh bìa hoặc gỡ ảnh.
      </div>

      <div className="toolbar">
        <div style={{ flex: 1 }}>
          <TextField
            label="Thêm mã tệp ảnh (fileId)"
            placeholder="24 ký tự hex, vd: 65f000000000000000000001"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            error={error}
          />
        </div>
        <Button variant="secondary" onClick={addFileId}>Thêm ảnh</Button>
      </div>

      {ids.length === 0 ? (
        <EmptyState title="Chưa có hình ảnh nào" description="Địa điểm vẫn có thể lưu và bổ sung ảnh sau." />
      ) : (
        <div className="thumb-grid">
          {ids.map((id, idx) => {
            const url = urlById.get(id);
            const isCover = cover === id;
            return (
              <div className="thumb-card" key={id}>
                {url ? (
                  <img src={url} alt={`Ảnh ${idx + 1}`} />
                ) : (
                  <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{id}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>#{idx + 1}</span>
                  {isCover && <Badge tone="success">Ảnh bìa</Badge>}
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  {!isCover && (
                    <Button variant="secondary" small onClick={() => setCover(id)}>Đặt bìa</Button>
                  )}
                  <Button variant="ghost" small disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Đưa lên">↑</Button>
                  <Button variant="ghost" small disabled={idx === ids.length - 1} onClick={() => move(idx, 1)} aria-label="Đưa xuống">↓</Button>
                  <Button variant="danger" small onClick={() => remove(id)}>Xóa</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-actions">
        <ModalCancel />
        <Button onClick={() => { onSave({ imageFileIds: ids, coverFileId: cover }); onClose(); }}>
          Xác nhận danh sách ảnh
        </Button>
      </div>
    </Modal>
  );
}
