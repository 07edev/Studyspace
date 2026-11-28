import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DuplicateCheck, DuplicateResult } from '@contracts/places';
import { api } from '../../../lib/api';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Modal, TextArea } from '../../../ui';
import { PLACE_CATEGORY_LABEL, PLACE_STATUS_LABEL, PLACE_STATUS_TONE } from '../placeLabels';

// A15 - Kiem tra trung lap dia diem (POST /admin/places/duplicate-check)
export function DuplicateCheckModal({
  payload,
  onClose,
  onOverride,
}: {
  payload: DuplicateCheck;
  onClose: () => void;
  onOverride?: (reason: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [result, setResult] = useState<DuplicateResult>();
  const [overrideReason, setOverrideReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    api
      .request<DuplicateResult>('/admin/places/duplicate-check', {
        method: 'POST',
        body: payload,
        signal: controller.signal,
      })
      .then(res => setResult(res))
      .catch(err => {
        if (!controller.signal.aborted) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [payload.name, payload.location.lat, payload.location.lng, payload.excludePlaceId, runCount]);

  const applyOverride = () => {
    if (overrideReason.trim().length < 10) {
      setReasonError('Lý do xác nhận không trùng cần tối thiểu 10 ký tự.');
      return;
    }
    setReasonError(undefined);
    onOverride?.(overrideReason.trim());
    onClose();
  };

  return (
    <Modal title="Kiểm tra địa điểm trùng lặp" size="L" onClose={onClose}>
      <p className="muted">
        Đối chiếu tên <strong>{payload.name}</strong> tại tọa độ {payload.location.lat.toFixed(5)}, {payload.location.lng.toFixed(5)}.
      </p>

      {loading && <LoadingState label="Đang kiểm tra địa điểm gần đó…" />}
      {!loading && error !== undefined && (
        <ErrorState error={error} onRetry={() => setRunCount(c => c + 1)} />
      )}
      {!loading && result && (
        <>
          {result.requiresReview ? (
            <div className="banner" role="alert">
              Phát hiện địa điểm có khả năng trùng lặp cao. Vui lòng đối chiếu trước khi tạo mới.
            </div>
          ) : (
            <div className="banner-info">
              Không phát hiện trùng lặp nghiêm trọng ({result.possibleDuplicates.length} kết quả tương đồng thấp).
            </div>
          )}

          {result.possibleDuplicates.length === 0 ? (
            <EmptyState
              title="Không tìm thấy địa điểm trùng lặp"
              description="Bạn có thể tiếp tục tạo hoặc duyệt địa điểm này."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Địa điểm hiện có</th>
                    <th>Danh mục</th>
                    <th>Trạng thái</th>
                    <th>Khoảng cách</th>
                    <th>Độ tương đồng</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.possibleDuplicates.map(item => (
                    <tr key={item.placeId}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.addressText && <div className="muted">{item.addressText}</div>}
                      </td>
                      <td>{PLACE_CATEGORY_LABEL[item.category]}</td>
                      <td>
                        <Badge tone={PLACE_STATUS_TONE[item.status]}>{PLACE_STATUS_LABEL[item.status]}</Badge>
                      </td>
                      <td>{Math.round(item.distanceMeters)} m</td>
                      <td>{Math.round(item.similarityScore * 100)}%</td>
                      <td>
                        <Link className="btn btn-secondary btn-sm" to={`/places/${item.placeId}`} onClick={onClose}>
                          Mở chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {onOverride && result.requiresReview && (
            <div className="form">
              <TextArea
                label="Lý do xác nhận vẫn tạo mới (không trùng)"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                hint="Tối thiểu 10 ký tự nếu đây là chi nhánh hoặc cơ sở khác."
                error={reasonError}
              />
              <div className="modal-actions">
                <Button variant="ghost" onClick={onClose}>Đóng</Button>
                <Button onClick={applyOverride}>Xác nhận giữ lý do</Button>
              </div>
            </div>
          )}

          {(!onOverride || !result.requiresReview) && (
            <div className="modal-actions">
              <Button variant="secondary" onClick={onClose}>Đóng</Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
