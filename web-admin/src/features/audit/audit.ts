import type { AuditEntry } from '@contracts/admin';

// Readable names for audit actions and object types. Teams add the ones they write; an action
// that is not listed is shown as its raw code, so nothing is ever hidden.
export const ACTION_LABEL: Record<string, string> = {
  USER_SUSPENDED: 'Khóa tài khoản',
  USER_UNSUSPENDED: 'Mở khóa tài khoản',
  ADMIN_CREATED: 'Thêm quản trị viên',
  ADMIN_UPDATED: 'Sửa quản trị viên',
  ADMIN_PERMISSIONS_REPLACED: 'Đổi quyền quản trị viên',
  ADMIN_REMOVED: 'Gỡ quyền quản trị',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  ACCOUNT_DELETION_REQUESTED: 'Yêu cầu xóa tài khoản',
};
export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action;

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  user: 'Người dùng',
  admin: 'Quản trị viên',
};
export const resourceTypeLabel = (type: string) => RESOURCE_TYPE_LABEL[type] ?? type;

export const ACTOR_TYPE_LABEL = { SYSTEM: 'Hệ thống', USER: 'Người dùng', ADMIN: 'Quản trị viên' } as const;

export const REDACTED = '[REDACTED]';

export const shortId = (id?: string) => (id ? id.slice(-6) : '—');

export function actorName(entry: AuditEntry): string {
  if (entry.actor?.displayName) return entry.actor.displayName;
  if (entry.actor?.email) return entry.actor.email;
  if (entry.actorType === 'SYSTEM') return 'Hệ thống';
  return entry.actorId ? `Tài khoản …${shortId(entry.actorId)}` : '—';
}

export type DiffRow = { field: string; before: unknown; after: unknown; changed: boolean };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One row per top-level field that appears before or after, marking which ones changed. */
export function diffRows(before?: Record<string, unknown>, after?: Record<string, unknown>): DiffRow[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return fields.map(field => ({
    field,
    before: before?.[field],
    after: after?.[field],
    changed: !same(before?.[field], after?.[field]),
  }));
}

/** How a value is written in the compare table; undefined means the field was absent. */
export function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === REDACTED) return '(đã ẩn)';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
