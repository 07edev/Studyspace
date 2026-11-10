import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ForbiddenPage, PermissionGate, RequireAdmin } from '../auth/guards';
import { can } from '../auth/permissions';
import { LoginPage } from '../pages/LoginPage';
import { EmptyState } from '../ui';
import { AdminShell } from './AdminShell';
import { adminPages } from './registry';

// "/" goes to the first page this admin may open.
function Landing() {
  const { user } = useAuth();
  const first = adminPages.find(page => can(user, page.access));
  if (!first) {
    return (
      <EmptyState
        title="Tài khoản chưa được cấp quyền nào"
        description="Liên hệ Super Admin để được cấp quyền truy cập các mục quản trị."
      />
    );
  }
  return <Navigate to={`/${first.path}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminShell />}>
          <Route index element={<Landing />} />
          {adminPages.map(page => {
            const gate = (element: React.ReactNode) => (
              <PermissionGate access={page.access} fallback={<ForbiddenPage />}>
                {element}
              </PermissionGate>
            );
            return [
              <Route key={page.id} path={page.path} element={gate(page.element)} />,
              ...(page.extraRoutes ?? []).map(extra => (
                <Route key={`${page.id}:${extra.path}`} path={extra.path} element={gate(extra.element)} />
              )),
            ];
          })}
          <Route path="*" element={<EmptyState title="Không tìm thấy trang" description="Đường dẫn này không tồn tại." />} />
        </Route>
      </Route>
    </Routes>
  );
}
