import type { UserAdminDetail } from '@contracts/admin';
import { formatDateTime, ROLE_LABEL, STATUS_LABEL, STATUS_TONE } from '../../lib/format';
import { Badge } from '../../ui';

const PROVIDER_LABEL: Record<string, string> = { PASSWORD: 'Mật khẩu', GOOGLE: 'Google' };

const COUNTS: { key: 'postCount' | 'documentCount' | 'reviewCount' | 'suggestionCount'; label: string }[] = [
  { key: 'postCount', label: 'Bài viết' },
  { key: 'documentCount', label: 'Tài liệu' },
  { key: 'reviewCount', label: 'Đánh giá' },
  { key: 'suggestionCount', label: 'Đề xuất' },
];

// Shared by the quick view (A06) and the detail page (ADM-04).
export function UserSummary({ detail }: { detail: UserAdminDetail }) {
  const { user } = detail;
  return (
    <div className="page">
      <dl className="facts">
        <dt>Tên hiển thị</dt><dd>{user.profile.displayName ?? '—'}</dd>
        <dt>Email</dt><dd>{user.email}{!user.emailVerified && <span className="muted"> (chưa xác minh)</span>}</dd>
        <dt>Số điện thoại</dt><dd>{user.phone ?? '—'}</dd>
        <dt>Vai trò</dt><dd>{ROLE_LABEL[user.role]}</dd>
        <dt>Trạng thái</dt><dd><Badge tone={STATUS_TONE[user.status]}>{STATUS_LABEL[user.status]}</Badge></dd>
        <dt>Đăng nhập bằng</dt><dd>{user.authProviders.map(p => PROVIDER_LABEL[p] ?? p).join(', ') || '—'}</dd>
        <dt>Ngày tạo</dt><dd>{formatDateTime(user.createdAt)}</dd>
        <dt>Đăng nhập gần nhất</dt><dd>{formatDateTime(user.lastLoginAt)}</dd>
      </dl>
      <div className="stats" aria-label="Nội dung của người dùng">
        {COUNTS.map(({ key, label }) => (
          <div className="stat" key={key}>
            {/* A missing count means "not available yet" (owner not connected), never zero. */}
            <strong>{detail[key] ?? '—'}</strong>
            <span className="muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
