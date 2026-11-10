import type { User } from '@contracts/auth';

// What a page or button needs. The server enforces the same rules on every request; this only
// decides what to show, so a hidden menu is a convenience and never the security boundary.
export type Access =
  | { superAdmin: true }
  | { module: string; action: string }
  | 'any-admin';

export function isAdminUser(user: User | undefined): user is User {
  return (
    !!user &&
    (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') &&
    user.admin?.status === 'ACTIVE'
  );
}

export function can(user: User | undefined, access: Access): boolean {
  if (!isAdminUser(user)) {
    return false;
  }
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }
  if (access === 'any-admin') {
    return true;
  }
  if ('superAdmin' in access) {
    return false;
  }
  return (user.admin?.permissions ?? []).some(
    p => p.module === access.module && p.actions.includes(access.action),
  );
}
