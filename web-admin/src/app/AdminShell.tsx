import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../auth/permissions';
import { Badge, Button, useConfirm, useToast } from '../ui';
import { adminPages } from './registry';

// Menu = registry entries the signed-in admin may open, grouped. No drawer: on narrow screens the
// menu becomes a scrolling bar at the top.
export function AdminShell() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const visible = adminPages.filter(page => can(user, page.access));
  const groups = [...new Set(visible.map(page => page.group))];

  const onLogout = async () => {
    if (await confirm({ title: 'Đăng xuất?', message: 'Bạn sẽ cần đăng nhập lại để tiếp tục.', confirmLabel: 'Đăng xuất' })) {
      await logout();
      toast('Bạn đã đăng xuất.');
    }
  };

  return (
    <div className="shell">
      <aside className="shell-side">
        <div className="brand">
          <span className="brand-mark" aria-hidden>S</span>
          <span>StudySpace</span>
        </div>
        <nav className="nav" aria-label="Menu quản trị">
          {groups.map(group => (
            <div className="nav-group" key={group}>
              <span className="nav-title">{group}</span>
              {visible
                .filter(page => page.group === group)
                .map(page => (
                  <NavLink key={page.id} to={`/${page.path}`} className="nav-link">
                    <page.icon size={18} aria-hidden />
                    {page.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>
      <header className="shell-top">
        <div className="who">
          <strong>{user?.profile.displayName ?? user?.email}</strong>
          <span className="muted">{user?.email}</span>
        </div>
        <Badge tone={user?.role === 'SUPER_ADMIN' ? 'success' : 'info'}>
          {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
        </Badge>
        <Button variant="secondary" small onClick={onLogout}>
          <LogOut size={16} aria-hidden /> Đăng xuất
        </Button>
      </header>
      <main className="shell-main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
