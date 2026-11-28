import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Suggestion } from '@contracts/places';
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
  PageHeader,
  SelectField,
  TextField,
  type Column,
} from '../../ui';
import {
  PLACE_CATEGORY_LABEL,
  placeFieldLabel,
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_STATUS_TONE,
  SUGGESTION_TYPE_LABEL,
} from '../places/placeLabels';

const TYPE_OPTIONS = [
  { value: 'CREATE', label: SUGGESTION_TYPE_LABEL.CREATE },
  { value: 'UPDATE', label: SUGGESTION_TYPE_LABEL.UPDATE },
];
const STATUS_OPTIONS = [
  { value: 'PENDING', label: SUGGESTION_STATUS_LABEL.PENDING },
  { value: 'APPROVED', label: SUGGESTION_STATUS_LABEL.APPROVED },
  { value: 'REJECTED', label: SUGGESTION_STATUS_LABEL.REJECTED },
];

// ADM-13 - Danh sach de xuat dia diem (+ A28 xem nhanh de xuat)
export function SuggestionsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [viewId, setViewId] = useState<string>();

  const q = useDebounced(search.trim());
  const filters = { q, type, status };
  const list = usePagedQuery<Suggestion>(queryKeys.suggestions.list(filters), '/admin/place-suggestions', filters);
  const filtered = q !== '' || type !== '' || status !== '';

  const columns: Column<Suggestion>[] = [
    {
      key: 'target',
      header: 'Đề xuất',
      render: s => (
        <div>
          <strong>{s.proposedPlace?.name ?? s.placeName ?? (s.placeId ? `Địa điểm #${s.placeId.slice(-6)}` : 'Đề xuất địa điểm')}</strong>
          <div className="muted">{SUGGESTION_TYPE_LABEL[s.type]}</div>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Người gửi',
      render: s => s.submittedBy.displayName,
    },
    {
      key: 'summary',
      header: 'Nội dung',
      render: s =>
        s.type === 'CREATE' && s.proposedPlace
          ? `${PLACE_CATEGORY_LABEL[s.proposedPlace.category]} · ${s.proposedPlace.address.line1}`
          : `${s.changes?.length ?? 0} trường đề xuất sửa`,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: s => <Badge tone={SUGGESTION_STATUS_TONE[s.status]}>{SUGGESTION_STATUS_LABEL[s.status]}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày gửi', render: s => formatDateTime(s.createdAt) },
    {
      key: 'actions',
      header: '',
      render: s => (
        <div className="row-actions">
          <Button variant="secondary" small onClick={() => setViewId(s.id)} aria-label={`Xem nhanh đề xuất ${s.id}`}>
            Xem
          </Button>
          <Link className="btn btn-primary btn-sm" to={`/place-suggestions/${s.id}`}>
            {s.status === 'PENDING' ? 'Xem & duyệt' : 'Chi tiết'}
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Đề xuất địa điểm"
        description="Tiếp nhận, đối chiếu và phê duyệt các đề xuất thêm mới hoặc chỉnh sửa thông tin địa điểm từ người dùng."
      />

      <Card>
        <div className="toolbar" role="search">
          <TextField
            label="Tìm kiếm"
            placeholder="Tên địa điểm hoặc lý do"
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={120}
          />
          <SelectField label="Loại đề xuất" value={type} onChange={e => setType(e.target.value)} options={TYPE_OPTIONS} placeholder="Tất cả" />
          <SelectField label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)} options={STATUS_OPTIONS} placeholder="Tất cả" />
          {filtered && (
            <Button variant="ghost" onClick={() => { setSearch(''); setType(''); setStatus(''); }}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        query={list}
        columns={columns}
        rowKey={s => s.id}
        page={list.page}
        onPageChange={list.setPage}
        caption="Danh sách đề xuất địa điểm"
        emptyTitle={filtered ? 'Không có đề xuất phù hợp' : 'Chưa có đề xuất nào'}
        emptyDescription={filtered ? 'Thử bỏ bớt bộ lọc để xem toàn bộ danh sách.' : undefined}
      />

      {/* A28 - Xem nhanh de xuat */}
      {viewId && <SuggestionQuickViewModal suggestionId={viewId} onClose={() => setViewId(undefined)} />}
    </div>
  );
}

function SuggestionQuickViewModal({ suggestionId, onClose }: { suggestionId: string; onClose: () => void }) {
  const query = useApiQuery<Suggestion>(
    queryKeys.suggestions.detail(suggestionId),
    `/admin/place-suggestions/${suggestionId}`,
  );
  const s = query.data;
  return (
    <Modal title="Xem nhanh đề xuất" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {s && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone="info">{SUGGESTION_TYPE_LABEL[s.type]}</Badge>
            <Badge tone={SUGGESTION_STATUS_TONE[s.status]}>{SUGGESTION_STATUS_LABEL[s.status]}</Badge>
          </div>
          <dl className="facts">
            <dt>Địa điểm</dt>
            <dd><strong>{s.proposedPlace?.name ?? s.placeName ?? s.placeId ?? '—'}</strong></dd>
            <dt>Người gửi</dt>
            <dd>{s.submittedBy.displayName}</dd>
            <dt>Ngày gửi</dt>
            <dd>{formatDateTime(s.createdAt)}</dd>
            {s.rejectionReason && (
              <>
                <dt>Lý do từ chối</dt>
                <dd>{s.rejectionReason}</dd>
              </>
            )}
            {s.type === 'UPDATE' && s.changes && (
              <>
                <dt>Trường sửa</dt>
                <dd>{s.changes.map(c => placeFieldLabel(c.fieldPath)).join(', ')}</dd>
              </>
            )}
          </dl>
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
            <Link className="btn" to={`/place-suggestions/${s.id}`} onClick={onClose}>
              Mở trang chi tiết & duyệt
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}
