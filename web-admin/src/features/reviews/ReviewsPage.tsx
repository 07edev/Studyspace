import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContentModerate, Review } from '@contracts/places';
import { PermissionGate } from '../../auth/guards';
import { api } from '../../lib/api';
import { formatDateTime, useDebounced } from '../../lib/format';
import { queryKeys, useApiQuery, usePagedQuery } from '../../lib/query';
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  LoadingState,
  Modal,
  ModalCancel,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit,
  useToast,
  type Column,
} from '../../ui';
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE } from '../places/placeLabels';

const RATING_OPTIONS = [5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} sao` }));
const STATUS_OPTIONS = [
  { value: 'PUBLISHED', label: REVIEW_STATUS_LABEL.PUBLISHED },
  { value: 'HIDDEN', label: REVIEW_STATUS_LABEL.HIDDEN },
  { value: 'DELETED', label: REVIEW_STATUS_LABEL.DELETED },
];

type ActiveModal =
  | { kind: 'detail'; reviewId: string }
  | { kind: 'moderate'; review: Review; action: 'HIDE' | 'RESTORE' };

// ADM-15 - Quan ly danh gia (+ A32 xem chi tiet, A33 an danh gia, A34 khoi phuc danh gia)
export function ReviewsPage() {
  const [search, setSearch] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<ActiveModal>();

  const q = useDebounced(search.trim());
  const trimmedPlaceId = placeId.trim();
  const filters = {
    q,
    placeId: trimmedPlaceId || undefined,
    rating: rating ? Number(rating) : undefined,
    status,
  };
  const list = usePagedQuery<Review>(queryKeys.reviews.list(filters), '/admin/reviews', filters);
  const filtered = q !== '' || trimmedPlaceId !== '' || rating !== '' || status !== '';

  const columns: Column<Review>[] = [
    {
      key: 'place',
      header: 'Địa điểm',
      render: r => (
        <Link to={`/places/${r.placeId}`}>
          <strong>{r.placeName ?? `Địa điểm #${r.placeId.slice(-6)}`}</strong>
        </Link>
      ),
    },
    { key: 'author', header: 'Người đánh giá', render: r => r.author.displayName },
    { key: 'rating', header: 'Điểm', render: r => `${r.rating} ★` },
    {
      key: 'content',
      header: 'Nội dung',
      render: r => (
        <span title={r.content}>
          {r.content ? (r.content.length > 90 ? `${r.content.slice(0, 90)}…` : r.content) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: r => <Badge tone={REVIEW_STATUS_TONE[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày tạo', render: r => formatDateTime(r.createdAt) },
    {
      key: 'actions',
      header: '',
      render: r => (
        <div className="row-actions">
          <Button
            variant="secondary"
            small
            onClick={() => setModal({ kind: 'detail', reviewId: r.id })}
            aria-label={`Chi tiết đánh giá ${r.id}`}
          >
            Chi tiết
          </Button>
          <PermissionGate access={{ module: 'REVIEWS', action: 'MODERATE' }}>
            {r.status === 'PUBLISHED' && (
              <Button
                variant="danger"
                small
                onClick={() => setModal({ kind: 'moderate', review: r, action: 'HIDE' })}
                aria-label={`Ẩn đánh giá ${r.id}`}
              >
                Ẩn
              </Button>
            )}
            {r.status === 'HIDDEN' && (
              <Button
                variant="primary"
                small
                onClick={() => setModal({ kind: 'moderate', review: r, action: 'RESTORE' })}
                aria-label={`Khôi phục đánh giá ${r.id}`}
              >
                Khôi phục
              </Button>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Quản lý đánh giá"
        description="Theo dõi, xem chi tiết và ẩn hoặc khôi phục đánh giá vi phạm quy chuẩn cộng đồng."
      />

      <Card>
        <div className="toolbar" role="search">
          <TextField
            label="Tìm nội dung"
            placeholder="Từ khóa trong nội dung đánh giá"
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={120}
          />
          <TextField
            label="Mã địa điểm (placeId)"
            placeholder="24 ký tự hex (tùy chọn)"
            value={placeId}
            onChange={e => setPlaceId(e.target.value)}
            maxLength={32}
          />
          <SelectField label="Số sao" value={rating} onChange={e => setRating(e.target.value)} options={RATING_OPTIONS} placeholder="Tất cả" />
          <SelectField label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)} options={STATUS_OPTIONS} placeholder="Tất cả" />
          {filtered && (
            <Button variant="ghost" onClick={() => { setSearch(''); setPlaceId(''); setRating(''); setStatus(''); }}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        query={list}
        columns={columns}
        rowKey={r => r.id}
        page={list.page}
        onPageChange={list.setPage}
        caption="Danh sách đánh giá địa điểm"
        emptyTitle={filtered ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá nào'}
        emptyDescription={filtered ? 'Thử thay đổi bộ lọc tìm kiếm.' : undefined}
      />

      {/* A32 - Xem chi tiet danh gia */}
      {modal?.kind === 'detail' && (
        <ReviewDetailModal reviewId={modal.reviewId} onClose={() => setModal(undefined)} />
      )}

      {/* A33 (An) / A34 (Khoi phuc) */}
      {modal?.kind === 'moderate' && (
        <ReviewModerateModal
          review={modal.review}
          action={modal.action}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  );
}

function ReviewDetailModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const query = useApiQuery<Review>(['reviews', 'detail', reviewId], `/admin/reviews/${reviewId}`);
  const r = query.data;
  return (
    <Modal title="Chi tiết đánh giá" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {r && (
        <>
          <dl className="facts">
            <dt>Địa điểm</dt>
            <dd>
              <Link to={`/places/${r.placeId}`} onClick={onClose}>
                {r.placeName ?? r.placeId}
              </Link>
            </dd>
            <dt>Người đánh giá</dt>
            <dd>{r.author.displayName}</dd>
            <dt>Điểm</dt>
            <dd>{r.rating} / 5 ★</dd>
            <dt>Trạng thái</dt>
            <dd><Badge tone={REVIEW_STATUS_TONE[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge></dd>
            <dt>Ngày tạo</dt>
            <dd>{formatDateTime(r.createdAt)}</dd>
            {r.updatedAt && (
              <>
                <dt>Cập nhật</dt>
                <dd>{formatDateTime(r.updatedAt)}</dd>
              </>
            )}
            <dt>Nội dung</dt>
            <dd>{r.content || '(Không có nội dung)'}</dd>
            {r.images && r.images.length > 0 && (
              <>
                <dt>Hình ảnh đính kèm</dt>
                <dd>{r.images.length} ảnh ({r.images.map(i => i.fileId).join(', ')})</dd>
              </>
            )}
          </dl>
          <div className="modal-actions">
            <Button onClick={onClose}>Đóng</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

const MIN_REASON = 10;

function ReviewModerateModal({
  review,
  action,
  onClose,
}: {
  review: Review;
  action: 'HIDE' | 'RESTORE';
  onClose: () => void;
}) {
  const isHide = action === 'HIDE';
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string>();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setLocalError(`Lý do cần tối thiểu ${MIN_REASON} ký tự.`);
      return;
    }
    setLocalError(undefined);
    const body: ContentModerate = { action, reason: reason.trim() };
    const updated = await submit.run(() =>
      api.request<Review>(`/admin/reviews/${review.id}/moderation`, { method: 'PATCH', body }),
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
    ]);
    if (updated) {
      toast(isHide ? 'Đã ẩn đánh giá và tính lại điểm địa điểm.' : 'Đã khôi phục đánh giá.');
      onClose();
    }
  };

  return (
    <Modal
      title={isHide ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}
      size="C"
      onClose={onClose}
      dirty={reason !== ''}
    >
      <form className="form" onSubmit={onSubmit} noValidate>
        <p>
          {isHide
            ? `Đánh giá của ${review.author.displayName} (${review.rating} ★) sẽ bị ẩn khỏi trang công khai và điểm trung bình địa điểm sẽ được tính lại.`
            : `Đánh giá của ${review.author.displayName} (${review.rating} ★) sẽ hiển thị trở lại và được tính lại vào điểm địa điểm.`}
        </p>
        <TextArea
          label="Lý do xử lý"
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={1000}
          hint={`Tối thiểu ${MIN_REASON} ký tự. Lưu trong nhật ký quản trị.`}
          error={localError ?? submit.fields.reason}
          data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" variant={isHide ? 'danger' : 'primary'} loading={submit.pending}>
            {isHide ? 'Ẩn đánh giá' : 'Khôi phục'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
