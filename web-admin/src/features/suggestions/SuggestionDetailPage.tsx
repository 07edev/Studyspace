import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ModerationDecision, Suggestion } from '@contracts/places';
import { PermissionGate } from '../../auth/guards';
import { ApiError, api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery } from '../../lib/query';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  ModalCancel,
  PageHeader,
  TextArea,
  useSubmit,
  useToast,
} from '../../ui';
import { formatValue } from '../audit/audit';
import { DuplicateCheckModal } from '../places/components/DuplicateCheckModal';
import { MapPicker } from '../places/components/MapPicker';
import {
  formatAddress,
  formatCoords,
  formatPriceRange,
  PLACE_CATEGORY_LABEL,
  placeFieldLabel,
  QUIET_LEVEL_LABEL,
  STUDY_SUITABILITY_LABEL,
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_STATUS_TONE,
  SUGGESTION_TYPE_LABEL,
  summarizeHours,
} from '../places/placeLabels';

type ActiveModal = 'approve' | 'reject' | 'diff' | 'duplicate';

// ADM-14 - Chi tiet & duyet de xuat (+ A15 kiem tra trung, A29 duyet, A30 tu choi, A31 so sanh diff)
export function SuggestionDetailPage() {
  const { suggestionId = '' } = useParams();
  const [modal, setModal] = useState<ActiveModal>();
  const query = useApiQuery<Suggestion>(
    queryKeys.suggestions.detail(suggestionId),
    `/admin/place-suggestions/${suggestionId}`,
  );

  if (query.isPending) return <LoadingState />;
  if (query.error || !query.data) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="page">
        <Link to="/place-suggestions">← Danh sách đề xuất</Link>
        {missing ? (
          <EmptyState title="Không tìm thấy đề xuất" description="Đề xuất không tồn tại hoặc đã bị gỡ." />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const s = query.data;
  const title = s.proposedPlace?.name ?? s.placeName ?? `Đề xuất #${s.id.slice(-6)}`;

  return (
    <div className="page">
      <Link to="/place-suggestions">← Danh sách đề xuất</Link>
      <PageHeader
        title={title}
        description={`${SUGGESTION_TYPE_LABEL[s.type]} · Người gửi: ${s.submittedBy.displayName} · v${s.version}`}
        actions={
          <>
            {s.type === 'CREATE' && s.proposedPlace && (
              <PermissionGate access={{ module: 'PLACES', action: 'CREATE' }}>
                <Button variant="secondary" onClick={() => setModal('duplicate')}>
                  Kiểm tra trùng
                </Button>
              </PermissionGate>
            )}
            {s.type === 'UPDATE' && s.changes && s.changes.length > 0 && (
              <Button variant="secondary" onClick={() => setModal('diff')}>
                So sánh chi tiết
              </Button>
            )}
            {s.status === 'PENDING' && (
              <PermissionGate access={{ module: 'SUGGESTIONS', action: 'MODERATE' }}>
                <Button variant="danger" onClick={() => setModal('reject')}>Từ chối</Button>
                <Button onClick={() => setModal('approve')}>Duyệt đề xuất</Button>
              </PermissionGate>
            )}
          </>
        }
      />

      <Card className="form">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge tone="info">{SUGGESTION_TYPE_LABEL[s.type]}</Badge>
          <Badge tone={SUGGESTION_STATUS_TONE[s.status]}>{SUGGESTION_STATUS_LABEL[s.status]}</Badge>
          {s.placeId && (
            <Link className="btn btn-secondary btn-sm" to={`/places/${s.placeId}`}>
              Mở địa điểm liên quan
            </Link>
          )}
        </div>
        <dl className="facts">
          <dt>Người đề xuất</dt>
          <dd>{s.submittedBy.displayName}</dd>
          <dt>Ngày gửi</dt>
          <dd>{formatDateTime(s.createdAt)}</dd>
          {s.reviewedAt && (
            <>
              <dt>Thời điểm xử lý</dt>
              <dd>{formatDateTime(s.reviewedAt)}</dd>
            </>
          )}
          {s.rejectionReason && (
            <>
              <dt>Lý do từ chối</dt>
              <dd><strong style={{ color: 'var(--error)' }}>{s.rejectionReason}</strong></dd>
            </>
          )}
          {s.evidenceFileIds && s.evidenceFileIds.length > 0 && (
            <>
              <dt>Tệp bằng chứng</dt>
              <dd>{s.evidenceFileIds.join(', ')}</dd>
            </>
          )}
        </dl>
      </Card>

      {s.type === 'CREATE' && s.proposedPlace && (
        <div className="form-grid">
          <Card className="form">
            <h2>Thông tin địa điểm đề xuất tạo mới</h2>
            <dl className="facts">
              <dt>Tên</dt>
              <dd><strong>{s.proposedPlace.name}</strong></dd>
              <dt>Danh mục</dt>
              <dd>{PLACE_CATEGORY_LABEL[s.proposedPlace.category]}</dd>
              <dt>Địa chỉ</dt>
              <dd>{formatAddress(s.proposedPlace.address)}</dd>
              <dt>Tọa độ</dt>
              <dd>{formatCoords(s.proposedPlace.location)}</dd>
              <dt>Giờ mở cửa</dt>
              <dd>{summarizeHours(s.proposedPlace.hours)}</dd>
              <dt>Khoảng giá</dt>
              <dd>{formatPriceRange(s.proposedPlace.price)}</dd>
              <dt>Môi trường</dt>
              <dd>
                {QUIET_LEVEL_LABEL[s.proposedPlace.quietLevel ?? 'UNKNOWN']} ·{' '}
                {STUDY_SUITABILITY_LABEL[s.proposedPlace.studySuitability ?? 'UNKNOWN']}
              </dd>
              <dt>Tiện ích</dt>
              <dd>{s.proposedPlace.amenities?.join(', ') || '—'}</dd>
              <dt>Mô tả</dt>
              <dd>{s.proposedPlace.description ?? '—'}</dd>
            </dl>
          </Card>
          <Card className="form">
            <h2>Vị trí trên bản đồ</h2>
            <MapPicker lat={s.proposedPlace.location.lat} lng={s.proposedPlace.location.lng} height={260} />
          </Card>
        </div>
      )}

      {s.type === 'UPDATE' && (
        <Card className="form">
          <h2>So sánh các trường đề xuất cập nhật</h2>
          {!s.changes || s.changes.length === 0 ? (
            <EmptyState title="Không có danh sách thay đổi" />
          ) : (
            <DiffTable suggestion={s} />
          )}
        </Card>
      )}

      {/* A31 - Modal so sanh chi tiet */}
      {modal === 'diff' && (
        <Modal title="So sánh dữ liệu trước / sau khi duyệt" size="L" onClose={() => setModal(undefined)}>
          <DiffTable suggestion={s} />
          <div className="modal-actions">
            <Button onClick={() => setModal(undefined)}>Đóng</Button>
          </div>
        </Modal>
      )}

      {/* A15 - Kiem tra trung lap */}
      {modal === 'duplicate' && s.proposedPlace && (
        <DuplicateCheckModal
          payload={{
            name: s.proposedPlace.name,
            location: s.proposedPlace.location,
            address: s.proposedPlace.address,
          }}
          onClose={() => setModal(undefined)}
        />
      )}

      {/* A29 / A30 */}
      {(modal === 'approve' || modal === 'reject') && (
        <DecisionModal
          suggestion={s}
          action={modal === 'approve' ? 'APPROVE' : 'REJECT'}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  );
}

function DiffTable({ suggestion }: { suggestion: Suggestion }) {
  return (
    <div className="table-wrap">
      <table className="table diff-table">
        <thead>
          <tr>
            <th>Trường dữ liệu</th>
            <th>Giá trị hiện tại</th>
            <th>Giá trị đề xuất</th>
            <th>Lý do người gửi</th>
          </tr>
        </thead>
        <tbody>
          {(suggestion.changes ?? []).map((change, idx) => (
            <tr key={`${change.fieldPath}-${idx}`} className="diff-changed">
              <td>
                <strong>{placeFieldLabel(change.fieldPath)}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{change.fieldPath}</div>
              </td>
              <td><code>{formatValue(change.oldValue)}</code></td>
              <td><code>{formatValue(change.newValue)}</code></td>
              <td>{change.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MIN_REASON = 10;

// A29 (Duyet) / A30 (Tu choi) voi CAS expectedVersion & Idempotency-Key
function DecisionModal({
  suggestion,
  action,
  onClose,
}: {
  suggestion: Suggestion;
  action: 'APPROVE' | 'REJECT';
  onClose: () => void;
}) {
  const isApprove = action === 'APPROVE';
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string>();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!isApprove && trimmed.length < MIN_REASON) {
      setLocalError(`Lý do từ chối cần tối thiểu ${MIN_REASON} ký tự.`);
      return;
    }
    if (isApprove && trimmed.length > 0 && trimmed.length < MIN_REASON) {
      setLocalError(`Ghi chú duyệt (nếu nhập) cần tối thiểu ${MIN_REASON} ký tự.`);
      return;
    }
    setLocalError(undefined);

    const body: ModerationDecision = {
      action,
      expectedVersion: suggestion.version,
      ...(trimmed ? { reason: trimmed } : {}),
    };
    const idempotencyKey = `suggestion-${action.toLowerCase()}-${suggestion.id}-v${suggestion.version}`;
    const updated = await submit.run(() =>
      api.request<Suggestion>(`/admin/place-suggestions/${suggestion.id}/decision`, {
        method: 'POST',
        body,
        idempotencyKey,
      }),
    );

    // Always refresh after success OR 409 conflict so admin sees latest version/status.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
    ]);

    if (updated) {
      toast(isApprove ? 'Đã duyệt đề xuất và cập nhật địa điểm.' : 'Đã từ chối đề xuất.');
      onClose();
    }
  };

  return (
    <Modal
      title={isApprove ? 'Xác nhận duyệt đề xuất' : 'Từ chối đề xuất'}
      size="C"
      onClose={onClose}
      dirty={reason !== ''}
    >
      <form className="form" onSubmit={onSubmit} noValidate>
        <p>
          {isApprove
            ? suggestion.type === 'CREATE'
              ? 'Hệ thống sẽ tạo địa điểm mới từ dữ liệu đề xuất và gửi thông báo kết quả tới người dùng.'
              : 'Hệ thống sẽ áp dụng các thay đổi hợp lệ (không bị khóa) vào địa điểm và ghi nhận lịch sử.'
            : 'Người gửi sẽ nhận được thông báo cùng lý do từ chối.'}
        </p>
        <TextArea
          label={isApprove ? 'Ghi chú duyệt (tùy chọn)' : 'Lý do từ chối *'}
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={1000}
          hint={isApprove ? 'Có thể để trống hoặc nhập tối thiểu 10 ký tự.' : `Tối thiểu ${MIN_REASON} ký tự.`}
          error={localError ?? submit.fields.reason}
          data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" variant={isApprove ? 'primary' : 'danger'} loading={submit.pending}>
            {isApprove ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
