import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Place } from '@contracts/places';
import { PermissionGate } from '../../auth/guards';
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
import { PlaceStatusDialog, type PlaceStatusAction } from './components/PlaceStatusDialog';
import {
  formatAddress,
  formatCoords,
  formatPriceRange,
  PLACE_CATEGORY_LABEL,
  PLACE_CATEGORY_OPTIONS,
  PLACE_ORIGIN_LABEL,
  PLACE_ORIGIN_OPTIONS,
  PLACE_STATUS_LABEL,
  PLACE_STATUS_OPTIONS,
  PLACE_STATUS_TONE,
  QUIET_LEVEL_LABEL,
  STUDY_SUITABILITY_LABEL,
  summarizeHours,
} from './placeLabels';

type ActiveModal =
  | { kind: 'add' }
  | { kind: 'view'; placeId: string }
  | { kind: 'status'; place: Place; targetStatus: PlaceStatusAction };

// ADM-06 - Danh sach dia diem (+ A12 chon cach them, A13 xuat ban/an, A14 xoa mem, A16 xem nhanh)
export function PlacesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [origin, setOrigin] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<ActiveModal>();

  const q = useDebounced(search.trim());
  const filters = { q, category, origin, status };
  const list = usePagedQuery<Place>(queryKeys.places.list(filters), '/admin/places', filters);
  const filtered = q !== '' || category !== '' || origin !== '' || status !== '';

  const columns: Column<Place>[] = [
    {
      key: 'name',
      header: 'Địa điểm',
      render: p => (
        <div>
          <strong>{p.name}</strong>
          <div className="muted">{formatAddress(p.address)}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Danh mục', render: p => PLACE_CATEGORY_LABEL[p.category] },
    { key: 'origin', header: 'Nguồn', render: p => <Badge tone="neutral">{PLACE_ORIGIN_LABEL[p.origin]}</Badge> },
    {
      key: 'status',
      header: 'Trạng thái',
      render: p => <Badge tone={PLACE_STATUS_TONE[p.status]}>{PLACE_STATUS_LABEL[p.status]}</Badge>,
    },
    {
      key: 'rating',
      header: 'Đánh giá',
      render: p => (p.ratingCount > 0 ? `${p.ratingAverage.toFixed(1)} ★ (${p.ratingCount})` : 'Chưa có'),
    },
    { key: 'updated', header: 'Cập nhật', render: p => formatDateTime(p.updatedAt) },
    {
      key: 'actions',
      header: '',
      render: p => (
        <div className="row-actions">
          <Button variant="secondary" small onClick={() => setModal({ kind: 'view', placeId: p.id })} aria-label={`Xem nhanh ${p.name}`}>
            Xem
          </Button>
          <Link className="btn btn-secondary btn-sm" to={`/places/${p.id}`} aria-label={`Chi tiết ${p.name}`}>
            Chi tiết
          </Link>
          <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
            <Link className="btn btn-secondary btn-sm" to={`/places/${p.id}/edit`} aria-label={`Sửa ${p.name}`}>
              Sửa
            </Link>
            {p.status === 'PUBLISHED' ? (
              <Button
                variant="secondary"
                small
                onClick={() => setModal({ kind: 'status', place: p, targetStatus: 'HIDDEN' })}
                aria-label={`Ẩn ${p.name}`}
              >
                Ẩn
              </Button>
            ) : p.status !== 'DELETED' ? (
              <Button
                variant="primary"
                small
                onClick={() => setModal({ kind: 'status', place: p, targetStatus: 'PUBLISHED' })}
                aria-label={`Xuất bản ${p.name}`}
              >
                Xuất bản
              </Button>
            ) : null}
            {p.status !== 'DELETED' && (
              <Button
                variant="danger"
                small
                onClick={() => setModal({ kind: 'status', place: p, targetStatus: 'DELETED' })}
                aria-label={`Xóa ${p.name}`}
              >
                Xóa
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
        title="Địa điểm học tập"
        description="Quản lý danh mục, thông tin, nguồn dữ liệu và trạng thái hiển thị địa điểm."
        actions={
          <PermissionGate access={{ module: 'PLACES', action: 'CREATE' }}>
            <Button onClick={() => setModal({ kind: 'add' })}>+ Thêm địa điểm</Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="toolbar" role="search">
          <TextField
            label="Tìm kiếm"
            placeholder="Tên địa điểm hoặc địa chỉ"
            value={search}
            onChange={e => setSearch(e.target.value)}
            maxLength={120}
          />
          <SelectField
            label="Danh mục"
            value={category}
            onChange={e => setCategory(e.target.value)}
            options={PLACE_CATEGORY_OPTIONS}
            placeholder="Tất cả"
          />
          <SelectField
            label="Nguồn dữ liệu"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            options={PLACE_ORIGIN_OPTIONS}
            placeholder="Tất cả"
          />
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={PLACE_STATUS_OPTIONS}
            placeholder="Tất cả"
          />
          {filtered && (
            <Button variant="ghost" onClick={() => { setSearch(''); setCategory(''); setOrigin(''); setStatus(''); }}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        query={list}
        columns={columns}
        rowKey={p => p.id}
        page={list.page}
        onPageChange={list.setPage}
        caption="Danh sách địa điểm học tập"
        emptyTitle={filtered ? 'Không có địa điểm phù hợp' : 'Chưa có địa điểm nào'}
        emptyDescription={filtered ? 'Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc.' : 'Nhấn "Thêm địa điểm" để khởi tạo dữ liệu đầu tiên.'}
      />

      {/* A12 - Chon cach them dia diem */}
      {modal?.kind === 'add' && (
        <Modal title="Thêm địa điểm mới" size="C" onClose={() => setModal(undefined)}>
          <p className="muted">Chọn phương thức tạo địa điểm học tập:</p>
          <div className="choice-grid">
            <button
              type="button"
              className="choice-card"
              onClick={() => { setModal(undefined); navigate('/places/new'); }}
            >
              <strong>Nhập thủ công</strong>
              <span className="muted">Điền trực tiếp biểu mẫu thông tin, tọa độ, tiện ích và giờ mở cửa.</span>
            </button>
            <button
              type="button"
              className="choice-card"
              onClick={() => { setModal(undefined); navigate('/places/import'); }}
            >
              <strong>Nhập từ API nguồn ngoài</strong>
              <span className="muted">Tìm ứng viên từ OpenStreetMap, Wikidata (hoặc Google Places) rồi rà soát trước khi lưu.</span>
            </button>
          </div>
        </Modal>
      )}

      {/* A16 - Xem nhanh dia diem */}
      {modal?.kind === 'view' && (
        <PlaceQuickViewModal placeId={modal.placeId} onClose={() => setModal(undefined)} />
      )}

      {/* A13 / A14 */}
      {modal?.kind === 'status' && (
        <PlaceStatusDialog
          place={modal.place}
          targetStatus={modal.targetStatus}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  );
}

function PlaceQuickViewModal({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const query = useApiQuery<Place>(queryKeys.places.detail(placeId), `/admin/places/${placeId}`);
  const p = query.data;
  return (
    <Modal title="Xem nhanh địa điểm" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {p && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 18 }}>{p.name}</h3>
            <Badge tone={PLACE_STATUS_TONE[p.status]}>{PLACE_STATUS_LABEL[p.status]}</Badge>
            <Badge tone="neutral">{PLACE_ORIGIN_LABEL[p.origin]}</Badge>
          </div>
          <dl className="facts">
            <dt>Danh mục</dt>
            <dd>{PLACE_CATEGORY_LABEL[p.category]}</dd>
            <dt>Địa chỉ</dt>
            <dd>{formatAddress(p.address)}</dd>
            <dt>Tọa độ</dt>
            <dd>{formatCoords(p.location)}</dd>
            <dt>Giờ mở cửa</dt>
            <dd>{summarizeHours(p.hours)}</dd>
            <dt>Khoảng giá</dt>
            <dd>{formatPriceRange(p.price)}</dd>
            <dt>Độ yên tĩnh</dt>
            <dd>{QUIET_LEVEL_LABEL[p.quietLevel]} · {STUDY_SUITABILITY_LABEL[p.studySuitability]}</dd>
            <dt>Đánh giá</dt>
            <dd>{p.ratingCount > 0 ? `${p.ratingAverage.toFixed(1)} ★ (${p.ratingCount} lượt)` : 'Chưa có đánh giá'}</dd>
            <dt>Tiện ích</dt>
            <dd>{p.amenities.length > 0 ? p.amenities.join(', ') : '—'}</dd>
            <dt>Phiên bản</dt>
            <dd>v{p.version} · Cập nhật {formatDateTime(p.updatedAt)}</dd>
          </dl>
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
            <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
              <Link className="btn btn-secondary" to={`/places/${p.id}/edit`} onClick={onClose}>Chỉnh sửa</Link>
            </PermissionGate>
            <Link className="btn" to={`/places/${p.id}`} onClick={onClose}>Mở trang chi tiết</Link>
          </div>
        </>
      )}
    </Modal>
  );
}
