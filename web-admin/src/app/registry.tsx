import {
  BarChart3, BookOpen, FileText, Flag, History, LayoutDashboard, type LucideIcon, MapPin,
  MessageSquare, ShieldCheck, Star, Users, Lightbulb,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Access } from '../auth/permissions';
import { AdminsPage } from '../features/admins/AdminsPage';
import { AuditPage } from '../features/audit/AuditPage';
import { PlaceDetailPage } from '../features/places/PlaceDetailPage';
import { PlaceFormPage } from '../features/places/PlaceFormPage';
import { PlaceImportPage } from '../features/places/PlaceImportPage';
import { PlacesPage } from '../features/places/PlacesPage';
import { ReviewsPage } from '../features/reviews/ReviewsPage';
import { ActivityPage } from '../features/stats/ActivityPage';
import { DashboardPage } from '../features/stats/DashboardPage';
import { SuggestionDetailPage } from '../features/suggestions/SuggestionDetailPage';
import { SuggestionsPage } from '../features/suggestions/SuggestionsPage';
import { UserDetailPage } from '../features/users/UserDetailPage';
import { UsersPage } from '../features/users/UsersPage';
import { PendingPage } from '../pages/PendingPage';

/**
 * The single list of Web Admin pages. Adding a page = adding one entry here; the menu, the route
 * and the permission check all come from it. Do not edit other people's entries.
 *
 * - `element`: the page. Until it is built it is a <PendingPage>; the owner replaces it.
 * - `extraRoutes`: detail pages of the same module (e.g. `users/:userId`), same permission.
 */
export type AdminPage = {
  id: string; // page id from the spec, e.g. ADM-03
  path: string; // relative to "/"
  label: string;
  group: string;
  icon: LucideIcon;
  access: Access;
  owner: 'TV1' | 'TV2' | 'TV3';
  element: ReactNode;
  extraRoutes?: { path: string; element: ReactNode }[];
};

const pending = (id: string, owner: AdminPage['owner'], title: string, needs?: string) => (
  <PendingPage id={id} owner={owner} title={title} needs={needs} />
);

export const adminPages: AdminPage[] = [
  {
    id: 'ADM-02', path: 'dashboard', label: 'Tổng quan', group: 'Tổng quan', icon: LayoutDashboard,
    access: { module: 'STATISTICS', action: 'READ' }, owner: 'TV1',
    element: <DashboardPage />,
  },
  {
    id: 'ADM-24', path: 'statistics', label: 'Thống kê hoạt động', group: 'Tổng quan', icon: BarChart3,
    access: { module: 'STATISTICS', action: 'READ' }, owner: 'TV1',
    element: <ActivityPage />,
  },
  {
    id: 'ADM-03', path: 'users', label: 'Người dùng', group: 'Tài khoản', icon: Users,
    access: { module: 'USERS', action: 'READ' }, owner: 'TV1',
    element: <UsersPage />,
    extraRoutes: [{ path: 'users/:userId', element: <UserDetailPage /> }], // ADM-04
  },
  {
    id: 'ADM-05', path: 'admins', label: 'Quản trị viên', group: 'Tài khoản', icon: ShieldCheck,
    access: { superAdmin: true }, owner: 'TV1',
    element: <AdminsPage />,
  },
  {
    id: 'ADM-06', path: 'places', label: 'Địa điểm', group: 'Địa điểm', icon: MapPin,
    access: { module: 'PLACES', action: 'READ' }, owner: 'TV2',
    element: <PlacesPage />,
    extraRoutes: [
      { path: 'places/import', element: <PlaceImportPage /> }, // ADM-08
      { path: 'places/new', element: <PlaceFormPage /> }, // ADM-09 (create)
      { path: 'places/:placeId/edit', element: <PlaceFormPage /> }, // ADM-09 (edit)
      { path: 'places/:placeId', element: <PlaceDetailPage /> }, // ADM-10
    ],
  },
  {
    id: 'ADM-13', path: 'place-suggestions', label: 'Đề xuất địa điểm', group: 'Địa điểm', icon: Lightbulb,
    access: { module: 'SUGGESTIONS', action: 'READ' }, owner: 'TV2',
    element: <SuggestionsPage />,
    extraRoutes: [{ path: 'place-suggestions/:suggestionId', element: <SuggestionDetailPage /> }], // ADM-14
  },
  {
    id: 'ADM-15', path: 'reviews', label: 'Đánh giá', group: 'Địa điểm', icon: Star,
    access: { module: 'REVIEWS', action: 'READ' }, owner: 'TV2',
    element: <ReviewsPage />,
  },
  {
    id: 'ADM-16', path: 'posts', label: 'Bài viết', group: 'Cộng đồng', icon: FileText,
    access: { module: 'POSTS', action: 'READ' }, owner: 'TV3',
    element: pending('ADM-16', 'TV3', 'Quản lý bài viết'),
  },
  {
    id: 'ADM-17', path: 'comments', label: 'Bình luận', group: 'Cộng đồng', icon: MessageSquare,
    access: { module: 'COMMENTS', action: 'READ' }, owner: 'TV3',
    element: pending('ADM-17', 'TV3', 'Quản lý bình luận'),
  },
  {
    id: 'ADM-18', path: 'documents', label: 'Tài liệu', group: 'Cộng đồng', icon: BookOpen,
    access: { module: 'DOCUMENTS', action: 'READ' }, owner: 'TV3',
    element: pending('ADM-18', 'TV3', 'Danh sách tài liệu'),
  },
  {
    id: 'ADM-22', path: 'reports', label: 'Báo cáo', group: 'Cộng đồng', icon: Flag,
    access: { module: 'REPORTS', action: 'READ' }, owner: 'TV3',
    element: pending('ADM-22', 'TV3', 'Danh sách báo cáo'),
  },
  {
    id: 'ADM-25', path: 'audit-logs', label: 'Nhật ký quản trị', group: 'Hệ thống', icon: History,
    access: { module: 'AUDIT', action: 'READ' }, owner: 'TV1',
    element: <AuditPage />,
  },
];
