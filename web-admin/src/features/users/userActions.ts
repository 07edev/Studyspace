import type { AdminUserView } from '@contracts/admin';
import type { User } from '@contracts/auth';

/**
 * Whether the lock / unlock button should be offered. Mirrors the server rules (which still
 * decide): never yourself, never a Super Admin, admins only by a Super Admin, and only states that
 * can be changed. Hiding the button is a convenience, not the protection.
 */
export function canChangeStatus(viewer: User | undefined, target: AdminUserView): boolean {
  if (!viewer || viewer.id === target.id || target.role === 'SUPER_ADMIN') return false;
  if (target.role === 'ADMIN' && viewer.role !== 'SUPER_ADMIN') return false;
  return ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'].includes(target.status);
}
