import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminUserView, UserAdminDetail } from '@contracts/admin';
import type { Review, Suggestion } from '@contracts/places';
import { useAdmin } from '../../auth/AuthProvider';
import { PermissionGate } from '../../auth/guards';
import { ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery, usePagedQuery } from '../../lib/query';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../ui';
import {
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  SUGGESTION_STATUS_LABEL,
  SUGGESTION_STATUS_TONE,
  SUGGESTION_TYPE_LABEL,
} from '../places/placeLabels';
import { canChangeStatus } from './userActions';
import { UserStatusDialog } from './UserStatusDialog';
import { UserSummary } from './UserSummary';
import { ViolationsModal } from './ViolationsModal';

type Kind = 'posts' | 'documents' | 'reviews' | 'suggestions';
const TABS: { id: Kind; label: string }[] = [
  { id: 'posts', label: 'Bài viết' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'reviews', label: 'Đánh giá' },
  { id: 'suggestions', label: 'Đề xuất' },
];

// ADM-04 - Chi tiet nguoi dung
export function UserDetailPage() {
  const { userId = '' } = useParams();
  const viewer = useAdmin();
  const [tab, setTab] = useState<Kind>('posts');
  const [dialog, setDialog] = useState<'status' | 'history'>();
  const query = useApiQuery<UserAdminDetail>(queryKeys.users.detail(userId), `/admin/users/${userId}`);

  if (query.isPending) return <LoadingState />;
  if (query.error || !query.data) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="page">
        <Link to="/users">← Danh sách người dùng</Link>
        {missing
          ? <EmptyState title="Không tìm thấy người dùng" description="Tài khoản này không tồn tại hoặc đã bị xóa." />
          : <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      </div>
    );
  }
  const detail = query.data;
  const user = detail.user;
  return (
    <div className="page">
      <Link to="/users">← Danh sách người dùng</Link>
      <PageHeader
        title={user.profile.displayName ?? user.email}
        description={user.email}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog('history')}>Lịch sử xử lý</Button>
            <PermissionGate access={{ module: 'USERS', action: 'UPDATE' }}>
              {canChangeStatus(viewer, user) && (
                <Button variant={user.status === 'SUSPENDED' ? 'primary' : 'danger'} onClick={() => setDialog('status')}>
                  {user.status === 'SUSPENDED' ? 'Mở khóa' : 'Khóa tài khoản'}
                </Button>
              )}
            </PermissionGate>
          </>
        }
      />
      <Card><UserSummary detail={detail} /></Card>

      <Card>
        <div className="tabs" role="tablist" aria-label="Nội dung của người dùng">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <ContentTab key={tab} userId={userId} kind={tab} />
      </Card>

      {dialog === 'status' && <UserStatusDialog user={user as AdminUserView} onClose={() => setDialog(undefined)} />}
      {dialog === 'history' && <ViolationsModal userId={userId} onClose={() => setDialog(undefined)} />}
    </div>
  );
}

// Items belong to TV2 (reviews, suggestions) and TV3 (posts, documents). TV2 renders structured
// tables for reviews & suggestions (while keeping generic fallback if minimal items are returned).
type ContentItem = { id?: string; title?: string; name?: string } & Partial<Review> & Partial<Suggestion>;
function ContentTab({ userId, kind }: { userId: string; kind: Kind }) {
  const query = usePagedQuery<ContentItem>(['users', kind, userId], `/admin/users/${userId}/${kind}`, {}, 10);
  if (query.isPending) return <LoadingState />;
  if (query.error && !query.data) {
    if (query.error instanceof ApiError && query.error.code === 'CONTENT_NOT_CONNECTED') {
      return <EmptyState title="Dữ liệu này chưa sẵn sàng" description="Phần này sẽ hiển thị khi module tương ứng được kết nối." />;
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.data || query.data.items.length === 0) return <EmptyState title="Người dùng chưa có nội dung nào" />;

  if (kind === 'reviews' && query.data.items.some(i => typeof i.rating === 'number')) {
    return (
      <div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Địa điểm</th>
                <th>Điểm</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item, idx) => (
                <tr key={item.id ?? idx}>
                  <td>
                    {item.placeId ? (
                      <Link to={`/places/${item.placeId}`}>{item.placeName ?? item.placeId}</Link>
                    ) : (
                      item.title ?? item.name ?? '—'
                    )}
                  </td>
                  <td>{typeof item.rating === 'number' ? `${item.rating} ★` : '—'}</td>
                  <td>{item.content ?? '—'}</td>
                  <td>
                    {item.status && item.status in REVIEW_STATUS_LABEL ? (
                      <Badge tone={REVIEW_STATUS_TONE[item.status as Review['status']]}>
                        {REVIEW_STATUS_LABEL[item.status as Review['status']]}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
      </div>
    );
  }

  if (kind === 'suggestions' && query.data.items.some(i => i.type === 'CREATE' || i.type === 'UPDATE')) {
    return (
      <div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Địa điểm</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Ngày gửi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item, idx) => (
                <tr key={item.id ?? idx}>
                  <td>{item.proposedPlace?.name ?? item.placeName ?? item.title ?? item.name ?? item.id ?? '—'}</td>
                  <td>{item.type ? SUGGESTION_TYPE_LABEL[item.type] : '—'}</td>
                  <td>
                    {item.status && item.status in SUGGESTION_STATUS_LABEL ? (
                      <Badge tone={SUGGESTION_STATUS_TONE[item.status as Suggestion['status']]}>
                        {SUGGESTION_STATUS_LABEL[item.status as Suggestion['status']]}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    {item.id && (
                      <Link className="btn btn-secondary btn-sm" to={`/place-suggestions/${item.id}`}>Chi tiết</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
      </div>
    );
  }

  return (
    <div>
      <ul className="plain-list">
        {query.data.items.map((item, index) => (
          <li key={item.id ?? index}>{item.title ?? item.name ?? item.id ?? 'Mục không tên'}</li>
        ))}
      </ul>
      <Pagination page={query.page} pagination={query.data.pagination} onChange={query.setPage} />
    </div>
  );
}
