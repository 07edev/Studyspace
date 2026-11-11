import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardStats } from '@contracts/admin';
import { PermissionGate } from '../../auth/guards';
import type { Access } from '../../auth/permissions';
import { queryKeys, useApiQuery } from '../../lib/query';
import { Button, Card, ErrorState, LoadingState, PageHeader } from '../../ui';
import { SegmentedControl } from './SegmentedControl';

const nf = new Intl.NumberFormat('vi-VN');
const DAY_OPTIONS = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }];

// A number that other teams own is absent until they are connected: shown as a dash, never as 0.
function Kpi({ label, value, note, to, access }: { label: string; value?: number; note?: string; to?: string; access?: Access }) {
  return (
    <div className="kpi">
      <span className="muted">{label}</span>
      <strong aria-label={value === undefined ? `${label}: chưa có số liệu` : undefined}>{value === undefined ? '—' : nf.format(value)}</strong>
      {value === undefined ? <span className="kpi-note">Chưa kết nối</span> : note && <span className="kpi-note">{note}</span>}
      {to && access && value !== undefined && (
        <PermissionGate access={access}><Link to={to}>Xem danh sách</Link></PermissionGate>
      )}
    </div>
  );
}

// ADM-02 - Dashboard: KPI + hang cho xu ly
export function DashboardPage() {
  const [days, setDays] = useState(7);
  const query = useApiQuery<DashboardStats>(queryKeys.stats.dashboard(days), '/admin/dashboard', {
    query: { days }, keepPrevious: true,
  });
  if (query.isPending) return <LoadingState />;
  if (query.error && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const stats = query.data!;
  const categories = Object.entries(stats.placesByCategory ?? {}).sort(([, a], [, b]) => b - a);
  const top = Math.max(1, ...categories.map(([, count]) => count));

  return (
    <div className="page">
      <PageHeader
        title="Tổng quan"
        description={`Số liệu tại thời điểm hiện tại. "Người dùng mới" tính trong ${days} ngày gần nhất (${stats.range.from} → ${stats.range.to}).`}
        actions={
          <>
            <SegmentedControl label="Khoảng thời gian" value={days} options={DAY_OPTIONS} onChange={setDays} />
            <Button variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}>Làm mới</Button>
          </>
        }
      />
      {stats.failedSources && stats.failedSources.length > 0 && (
        <div className="banner" role="alert">
          Chưa lấy được số liệu từ: {stats.failedSources.join(', ')}. Các số đó đang để trống.
        </div>
      )}

      <section className={query.isPlaceholderData || query.isFetching ? 'viz-stale' : undefined} aria-busy={query.isFetching || undefined}>
        <h2>Người dùng</h2>
        <div className="stat-grid">
          <Kpi label="Tổng người dùng" value={stats.totalUsers} note="Không tính tài khoản đã xóa và quản trị viên" />
          <Kpi label="Người dùng mới" value={stats.newUsers} note={`Trong ${days} ngày gần nhất`} />
        </div>
      </section>

      <section className={query.isPlaceholderData || query.isFetching ? 'viz-stale' : undefined}>
        <h2>Nội dung</h2>
        <div className="stat-grid">
          <Kpi label="Địa điểm" value={stats.totalPlaces} />
          <Kpi label="Bài viết" value={stats.totalPosts} />
          <Kpi label="Tài liệu" value={stats.totalDocuments} />
        </div>
      </section>

      <section className={query.isPlaceholderData || query.isFetching ? 'viz-stale' : undefined}>
        <h2>Cần xử lý</h2>
        <div className="stat-grid">
          <Kpi label="Đề xuất địa điểm chờ duyệt" value={stats.pendingSuggestions} to="/place-suggestions" access={{ module: 'SUGGESTIONS', action: 'READ' }} />
          <Kpi label="Tài liệu chờ duyệt" value={stats.pendingDocuments} to="/documents" access={{ module: 'DOCUMENTS', action: 'READ' }} />
          <Kpi label="Báo cáo đang mở" value={stats.openReports} to="/reports" access={{ module: 'REPORTS', action: 'READ' }} />
        </div>
      </section>

      {categories.length > 0 && (
        <Card>
          <h2>Địa điểm theo danh mục</h2>
          <ul className="ranked" aria-label="Số địa điểm theo danh mục">
            {categories.map(([name, count]) => (
              <li key={name}>
                <span>{name}</span>
                <span className="ranked-bar" aria-hidden><span style={{ width: `${(count / top) * 100}%` }} /></span>
                <strong>{nf.format(count)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
