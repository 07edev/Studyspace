import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  FieldDecision,
  FieldState,
  FieldVerifiedStatus,
  Place,
  PlaceHistory,
  Review,
} from '@contracts/places';
import { PermissionGate } from '../../auth/guards';
import { ApiError, api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery, usePagedQuery } from '../../lib/query';
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
  Pagination,
  SelectField,
  TextArea,
  useSubmit,
  useToast,
} from '../../ui';
import { formatValue } from '../audit/audit';
import { MapPicker } from './components/MapPicker';
import { PlaceStatusDialog, type PlaceStatusAction } from './components/PlaceStatusDialog';
import {
  DAY_OF_WEEK_LABEL,
  FIELD_VERIFIED_LABEL,
  FIELD_VERIFIED_TONE,
  formatAddress,
  formatCoords,
  formatPriceRange,
  GOVERNED_FIELD_PATHS,
  PLACE_CATEGORY_LABEL,
  PLACE_ORIGIN_LABEL,
  PLACE_STATUS_LABEL,
  PLACE_STATUS_TONE,
  placeFieldLabel,
  QUIET_LEVEL_LABEL,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  STUDY_SUITABILITY_LABEL,
} from './placeLabels';

type DetailModal =
  | { kind: 'status'; targetStatus: PlaceStatusAction }
  | { kind: 'verify'; path: string; current?: FieldState }
  | { kind: 'lock'; path: string; current?: FieldState }
  | { kind: 'history' }
  | { kind: 'review'; review: Review };

// ADM-10 - Chi tiet dia diem (+ A13/A14, A24 xac minh truong, A25 khoa/mo khoa truong, A26 lich su diff, A27 chi tiet danh gia)
export function PlaceDetailPage() {
  const { placeId = '' } = useParams();
  const [modal, setModal] = useState<DetailModal>();
  const query = useApiQuery<Place>(queryKeys.places.detail(placeId), `/admin/places/${placeId}`);

  if (query.isPending) return <LoadingState />;
  if (query.error || !query.data) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="page">
        <Link to="/places">← Danh sách địa điểm</Link>
        {missing ? (
          <EmptyState title="Không tìm thấy địa điểm" description="Địa điểm không tồn tại hoặc đã bị xóa." />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const place = query.data;
  const fieldStateByPath = new Map((place.fieldStates ?? []).map(fs => [fs.path, fs]));

  return (
    <div className="page">
      <Link to="/places">← Danh sách địa điểm</Link>
      <PageHeader
        title={place.name}
        description={`${PLACE_CATEGORY_LABEL[place.category]} · ${formatAddress(place.address)} · Phiên bản v${place.version}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setModal({ kind: 'history' })}>
              Lịch sử thay đổi
            </Button>
            <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
              <Link className="btn btn-secondary" to={`/places/${place.id}/edit`}>Chỉnh sửa</Link>
              {place.status === 'PUBLISHED' ? (
                <Button variant="secondary" onClick={() => setModal({ kind: 'status', targetStatus: 'HIDDEN' })}>
                  Ẩn địa điểm
                </Button>
              ) : place.status !== 'DELETED' ? (
                <Button onClick={() => setModal({ kind: 'status', targetStatus: 'PUBLISHED' })}>
                  Xuất bản
                </Button>
              ) : null}
              {place.status !== 'DELETED' && (
                <Button variant="danger" onClick={() => setModal({ kind: 'status', targetStatus: 'DELETED' })}>
                  Xóa mềm
                </Button>
              )}
            </PermissionGate>
          </>
        }
      />

      <div className="form-grid">
        <Card className="form">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone={PLACE_STATUS_TONE[place.status]}>{PLACE_STATUS_LABEL[place.status]}</Badge>
            <Badge tone="neutral">{PLACE_ORIGIN_LABEL[place.origin]}</Badge>
            {place.ratingCount > 0 && (
              <Badge tone="info">{place.ratingAverage.toFixed(1)} ★ ({place.ratingCount})</Badge>
            )}
          </div>
          <dl className="facts">
            <dt>Địa chỉ</dt>
            <dd>{formatAddress(place.address)}</dd>
            <dt>Tọa độ</dt>
            <dd>{formatCoords(place.location)}</dd>
            <dt>Điện thoại</dt>
            <dd>{place.phone ?? '—'}</dd>
            <dt>Website</dt>
            <dd>{place.website ? <a href={place.website} target="_blank" rel="noreferrer">{place.website}</a> : '—'}</dd>
            <dt>Khoảng giá</dt>
            <dd>{formatPriceRange(place.price)}</dd>
            <dt>Môi trường</dt>
            <dd>{QUIET_LEVEL_LABEL[place.quietLevel]} · {STUDY_SUITABILITY_LABEL[place.studySuitability]}</dd>
            <dt>Tiện ích</dt>
            <dd>{place.amenities.length > 0 ? place.amenities.join(', ') : '—'}</dd>
            <dt>Mô tả</dt>
            <dd>{place.description ?? '—'}</dd>
            <dt>Tạo / Cập nhật</dt>
            <dd>{formatDateTime(place.createdAt)} · {formatDateTime(place.updatedAt)}</dd>
          </dl>
        </Card>

        <Card className="form">
          <h2>Bản đồ & Giờ mở cửa</h2>
          <MapPicker lat={place.location.lat} lng={place.location.lng} height={220} />
          {place.hours.length === 0 ? (
            <p className="muted">Chưa cập nhật giờ mở cửa.</p>
          ) : (
            <dl className="facts">
              {place.hours.map(d => (
                <div key={d.day} style={{ display: 'contents' }}>
                  <dt>{DAY_OF_WEEK_LABEL[d.day]}</dt>
                  <dd>
                    {d.closed
                      ? 'Đóng cửa'
                      : d.intervals.map(iv => `${iv.open}–${iv.close}${iv.overnight ? ' (+1)' : ''}`).join(', ')}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      {/* Provenance sources */}
      <Card className="form">
        <h2>Nguồn gốc dữ liệu (Provenance)</h2>
        {!place.sources || place.sources.length === 0 ? (
          <p className="muted">Chưa có bản ghi nguồn ngoài — địa điểm tạo thủ công hoặc từ đề xuất người dùng.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nguồn</th>
                  <th>Mã ngoài</th>
                  <th>Thời điểm lấy</th>
                  <th>Ghi chú bản quyền</th>
                </tr>
              </thead>
              <tbody>
                {place.sources.map((src, idx) => (
                  <tr key={`${src.provider}:${src.providerPlaceId}:${idx}`}>
                    <td><Badge tone="info">{PLACE_ORIGIN_LABEL[src.provider]}</Badge></td>
                    <td>
                      {src.sourceUrl ? (
                        <a href={src.sourceUrl} target="_blank" rel="noreferrer">{src.providerPlaceId}</a>
                      ) : (
                        src.providerPlaceId
                      )}
                    </td>
                    <td>{formatDateTime(src.fetchedAt)}</td>
                    <td>{src.licenseNote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Field governance: A24 verify & A25 lock/unlock */}
      <Card className="form">
        <h2>Quản trị trạng thái từng trường (Xác minh & Khóa trường)</h2>
        <p className="muted">
          Trường đã khóa sẽ ngăn cập nhật ngoài ý muốn từ đồng bộ nguồn ngoài hoặc đề xuất người dùng.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trường dữ liệu</th>
                <th>Xác minh</th>
                <th>Khóa chỉnh sửa</th>
                <th>Ghi chú</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {GOVERNED_FIELD_PATHS.map(path => {
                const state = fieldStateByPath.get(path);
                const verified: FieldVerifiedStatus = state?.verified ?? 'UNVERIFIED';
                const locked = Boolean(state?.locked);
                return (
                  <tr key={path}>
                    <td>
                      <strong>{placeFieldLabel(path)}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{path}</div>
                    </td>
                    <td>
                      <Badge tone={FIELD_VERIFIED_TONE[verified]}>{FIELD_VERIFIED_LABEL[verified]}</Badge>
                    </td>
                    <td>
                      <Badge tone={locked ? 'danger' : 'neutral'}>{locked ? 'Đang khóa' : 'Mở'}</Badge>
                    </td>
                    <td>{state?.note ?? '—'}</td>
                    <td>
                      <PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}>
                        <div className="row-actions">
                          <Button
                            variant="secondary"
                            small
                            onClick={() => setModal({ kind: 'verify', path, current: state })}
                            aria-label={`Xác minh ${path}`}
                          >
                            Xác minh
                          </Button>
                          <Button
                            variant={locked ? 'secondary' : 'danger'}
                            small
                            onClick={() => setModal({ kind: 'lock', path, current: state })}
                            aria-label={`${locked ? 'Mở khóa' : 'Khóa'} ${path}`}
                          >
                            {locked ? 'Mở khóa' : 'Khóa'}
                          </Button>
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Place Reviews section (A27) */}
      <PermissionGate access={{ module: 'REVIEWS', action: 'READ' }}>
        <PlaceReviewsSection
          placeId={place.id}
          onSelectReview={review => setModal({ kind: 'review', review })}
        />
      </PermissionGate>

      {modal?.kind === 'status' && (
        <PlaceStatusDialog
          place={place}
          targetStatus={modal.targetStatus}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === 'verify' && (
        <FieldVerifyModal
          placeId={place.id}
          path={modal.path}
          current={modal.current}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === 'lock' && (
        <FieldLockModal
          placeId={place.id}
          path={modal.path}
          current={modal.current}
          onClose={() => setModal(undefined)}
        />
      )}
      {modal?.kind === 'history' && (
        <PlaceHistoryModal placeId={place.id} onClose={() => setModal(undefined)} />
      )}
      {modal?.kind === 'review' && (
        <Modal title="Chi tiết đánh giá của địa điểm" size="L" onClose={() => setModal(undefined)}>
          <dl className="facts">
            <dt>Người đánh giá</dt>
            <dd>{modal.review.author.displayName}</dd>
            <dt>Số sao</dt>
            <dd>{modal.review.rating} / 5 ★</dd>
            <dt>Trạng thái</dt>
            <dd><Badge tone={REVIEW_STATUS_TONE[modal.review.status]}>{REVIEW_STATUS_LABEL[modal.review.status]}</Badge></dd>
            <dt>Thời gian</dt>
            <dd>{formatDateTime(modal.review.createdAt)}</dd>
            <dt>Nội dung</dt>
            <dd>{modal.review.content || '(Không có nội dung văn bản)'}</dd>
          </dl>
          <div className="modal-actions">
            <Link className="btn btn-secondary" to="/reviews" onClick={() => setModal(undefined)}>
              Mở trang Quản lý đánh giá
            </Link>
            <Button onClick={() => setModal(undefined)}>Đóng</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// A24 - Xac minh trang thai truong du lieu
function FieldVerifyModal({
  placeId,
  path,
  current,
  onClose,
}: {
  placeId: string;
  path: string;
  current?: FieldState;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();
  const [verified, setVerified] = useState<FieldVerifiedStatus>(current?.verified ?? 'VERIFIED');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string>();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setLocalError('Lý do cần tối thiểu 5 ký tự.');
      return;
    }
    setLocalError(undefined);
    const body: FieldDecision = { path, verified, reason: reason.trim() };
    const updated = await submit.run(() =>
      api.request<Place>(`/admin/places/${placeId}/fields/state`, { method: 'PATCH', body }),
    );
    if (updated) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.places.detail(placeId) });
      toast('Đã cập nhật trạng thái xác minh trường.');
      onClose();
    }
  };

  return (
    <Modal title={`Xác minh trường: ${placeFieldLabel(path)}`} size="C" onClose={onClose} dirty={reason !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <SelectField
          label="Trạng thái xác minh"
          value={verified}
          onChange={e => setVerified(e.target.value as FieldVerifiedStatus)}
          options={[
            { value: 'VERIFIED', label: 'Đã xác minh' },
            { value: 'UNVERIFIED', label: 'Chưa xác minh' },
            { value: 'DISPUTED', label: 'Cần đối chiếu' },
          ]}
        />
        <TextArea
          label="Ghi chú / căn cứ xác minh"
          value={reason}
          onChange={e => setReason(e.target.value)}
          hint="Tối thiểu 5 ký tự."
          error={localError ?? submit.fields.reason}
          data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" loading={submit.pending}>Lưu trạng thái</Button>
        </div>
      </form>
    </Modal>
  );
}

// A25 - Khoa / Mo khoa truong du lieu
function FieldLockModal({
  placeId,
  path,
  current,
  onClose,
}: {
  placeId: string;
  path: string;
  current?: FieldState;
  onClose: () => void;
}) {
  const locked = Boolean(current?.locked);
  const toast = useToast();
  const queryClient = useQueryClient();
  const submit = useSubmit();
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string>();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 5) {
      setLocalError('Lý do cần tối thiểu 5 ký tự.');
      return;
    }
    setLocalError(undefined);
    const body: FieldDecision = { path, action: locked ? 'UNLOCK' : 'LOCK', reason: reason.trim() };
    const updated = await submit.run(() =>
      api.request<Place>(`/admin/places/${placeId}/fields/state`, { method: 'PATCH', body }),
    );
    if (updated) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.places.detail(placeId) });
      toast(locked ? 'Đã mở khóa trường dữ liệu.' : 'Đã khóa trường dữ liệu.');
      onClose();
    }
  };

  return (
    <Modal title={`${locked ? 'Mở khóa' : 'Khóa'} trường: ${placeFieldLabel(path)}`} size="C" onClose={onClose} dirty={reason !== ''}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <p>
          {locked
            ? `Mở khóa cho phép chỉnh sửa lại trường "${placeFieldLabel(path)}".`
            : `Khóa trường "${placeFieldLabel(path)}" sẽ ngăn sửa đổi từ biểu mẫu và đề xuất người dùng.`}
        </p>
        <TextArea
          label="Lý do"
          value={reason}
          onChange={e => setReason(e.target.value)}
          hint="Tối thiểu 5 ký tự."
          error={localError ?? submit.fields.reason}
          data-autofocus
        />
        {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
        <div className="modal-actions">
          <ModalCancel />
          <Button type="submit" variant={locked ? 'primary' : 'danger'} loading={submit.pending}>
            {locked ? 'Mở khóa trường' : 'Khóa trường'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// A26 - Lich su thay doi dia diem (diff before/after)
function PlaceHistoryModal({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const query = usePagedQuery<PlaceHistory>(
    queryKeys.places.history(placeId),
    `/admin/places/${placeId}/history`,
    {},
    10,
  );

  return (
    <Modal title="Lịch sử thay đổi địa điểm" size="L" onClose={onClose}>
      {query.isPending && <LoadingState />}
      {query.error && !query.data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState title="Chưa có lịch sử thay đổi" />
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul className="timeline">
            {query.data.items.map(item => (
              <li key={item.id}>
                <div style={{ marginBottom: 6 }}>
                  <strong>{formatDateTime(item.changedAt)}</strong> · <span className="muted">Tác nhân: {item.actorId}</span>
                </div>
                <div className="table-wrap">
                  <table className="table diff-table">
                    <thead>
                      <tr>
                        <th>Trường</th>
                        <th>Trước</th>
                        <th>Sau</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.diff.map((d, idx) => (
                        <tr key={`${d.field}-${idx}`} className="diff-changed">
                          <td>
                            <strong>{placeFieldLabel(d.field)}</strong>
                            {d.source && <div className="muted" style={{ fontSize: 12 }}>{d.source}</div>}
                          </td>
                          <td><code>{formatValue(d.before)}</code></td>
                          <td><code>{formatValue(d.after)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
        </>
      )}
    </Modal>
  );
}

function PlaceReviewsSection({
  placeId,
  onSelectReview,
}: {
  placeId: string;
  onSelectReview: (review: Review) => void;
}) {
  const query = usePagedQuery<Review>(
    queryKeys.reviews.list({ placeId }),
    '/admin/reviews',
    { placeId },
    5,
  );

  return (
    <Card className="form">
      <div className="section-head">
        <h2>Đánh giá của người dùng</h2>
        <Link className="btn btn-secondary btn-sm" to="/reviews">Xem tất cả đánh giá</Link>
      </div>
      {query.isPending && <LoadingState />}
      {query.error && !query.data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState title="Chưa có đánh giá nào cho địa điểm này" />
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Điểm</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.items.map(r => (
                  <tr key={r.id}>
                    <td>{r.author.displayName}</td>
                    <td>{r.rating} ★</td>
                    <td>{r.content ?? '—'}</td>
                    <td><Badge tone={REVIEW_STATUS_TONE[r.status]}>{REVIEW_STATUS_LABEL[r.status]}</Badge></td>
                    <td>
                      <Button variant="secondary" small onClick={() => onSelectReview(r)}>Chi tiết</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
        </>
      )}
    </Card>
  );
}
