import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button, EmptyState, ErrorState, Spinner } from '../ui';
import { useAuth } from './AuthProvider';
import { can, type Access } from './permissions';

/** Routes inside need a signed-in, active admin. Everything else goes to the login page. */
export function RequireAdmin() {
  const { state, retryRestore } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') {
    return (
      <div className="center-screen">
        <Spinner label="Đang kiểm tra phiên đăng nhập…" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="center-screen">
        <ErrorState title="Không kết nối được máy chủ" error={state.error} onRetry={retryRestore} />
      </div>
    );
  }
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function ForbiddenPage() {
  return (
    <EmptyState
      title="Bạn không có quyền truy cập trang này"
      description="Liên hệ Super Admin nếu bạn cần quyền này."
      action={<Button variant="secondary" onClick={() => history.back()}>Quay lại</Button>}
    />
  );
}

/**
 * Shows its children only when the signed-in admin holds the permission; otherwise `fallback`
 * (nothing by default, so buttons simply disappear). For whole pages use `fallback={<ForbiddenPage />}`.
 * The server checks permission on every request regardless.
 */
export function PermissionGate({
  access, fallback = null, children,
}: { access: Access; fallback?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  return can(user, access) ? <>{children}</> : <>{fallback}</>;
}
