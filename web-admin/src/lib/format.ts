import { useEffect, useState } from 'react';
import type { AccountStatus, Role } from '@contracts/api';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

export const formatDateTime = (iso?: string) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso?: string) => (iso ? dateOnly.format(new Date(iso)) : '—');

export const STATUS_LABEL: Record<AccountStatus, string> = {
  PENDING_VERIFICATION: 'Chờ xác minh',
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Bị khóa',
  DELETION_REQUESTED: 'Yêu cầu xóa',
  DELETED: 'Đã xóa',
};
export const STATUS_TONE: Record<AccountStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  DELETION_REQUESTED: 'warning',
  DELETED: 'neutral',
};
export const ROLE_LABEL: Record<Role, string> = { USER: 'Người dùng', ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin' };

/** Returns `value` after it has stopped changing for `delayMs` (search boxes). */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
