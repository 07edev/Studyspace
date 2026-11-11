import type { Permission } from '@contracts/api';

// Modules an ADMIN can be given and the actions each one uses (from the scopes in the G1 spec).
// ADMINS is absent on purpose: managing admins is Super Admin only. Add actions here when a
// module starts using one.
export const PERMISSION_CATALOG: { module: string; label: string; actions: string[] }[] = [
  { module: 'USERS', label: 'Người dùng', actions: ['READ', 'UPDATE'] },
  { module: 'PLACES', label: 'Địa điểm', actions: ['READ', 'CREATE', 'UPDATE'] },
  { module: 'SUGGESTIONS', label: 'Đề xuất địa điểm', actions: ['READ', 'MODERATE'] },
  { module: 'REVIEWS', label: 'Đánh giá', actions: ['READ', 'MODERATE'] },
  { module: 'POSTS', label: 'Bài viết', actions: ['READ', 'MODERATE'] },
  { module: 'COMMENTS', label: 'Bình luận', actions: ['READ', 'MODERATE'] },
  { module: 'DOCUMENTS', label: 'Tài liệu', actions: ['READ', 'MODERATE'] },
  { module: 'REPORTS', label: 'Báo cáo', actions: ['READ', 'MODERATE', 'ASSIGN'] },
  { module: 'STATISTICS', label: 'Thống kê', actions: ['READ'] },
  { module: 'AUDIT', label: 'Nhật ký quản trị', actions: ['READ'] },
];

export const ACTION_LABEL: Record<string, string> = {
  READ: 'Xem',
  CREATE: 'Tạo',
  UPDATE: 'Sửa',
  DELETE: 'Xóa',
  MODERATE: 'Kiểm duyệt',
  ASSIGN: 'Phân công',
};

const has = (value: Permission[], module: string, action: string) =>
  value.some(p => p.module === module && p.actions.includes(action));

/** Returns a new list with one cell switched; a module with no actions left is dropped. */
export function togglePermission(value: Permission[], module: string, action: string): Permission[] {
  const current = value.find(p => p.module === module);
  if (!current) return [...value, { module, actions: [action] }];
  const actions = current.actions.includes(action)
    ? current.actions.filter(a => a !== action)
    : [...current.actions, action];
  return actions.length === 0
    ? value.filter(p => p.module !== module)
    : value.map(p => (p.module === module ? { module, actions } : p));
}

/** True when two lists grant exactly the same access (order does not matter). */
export function samePermissions(a: Permission[], b: Permission[]): boolean {
  const flat = (list: Permission[]) =>
    list.flatMap(p => p.actions.map(action => `${p.module}.${action}`)).sort().join(',');
  return flat(a) === flat(b);
}

export function summarize(permissions: Permission[]): string {
  if (permissions.length === 0) return 'Chưa có quyền nào';
  return permissions
    .map(p => PERMISSION_CATALOG.find(c => c.module === p.module)?.label ?? p.module)
    .join(', ');
}

// Grid of modules x actions. A cell that a module does not use is left empty.
export function PermissionMatrix({
  value, onChange, disabled = false,
}: { value: Permission[]; onChange: (next: Permission[]) => void; disabled?: boolean }) {
  const columns = ['READ', 'CREATE', 'UPDATE', 'MODERATE', 'ASSIGN'];
  return (
    <div className="table-wrap">
      <table className="table matrix">
        <caption className="sr-only">Quyền theo từng mục</caption>
        <thead>
          <tr>
            <th scope="col">Mục</th>
            {columns.map(action => <th key={action} scope="col">{ACTION_LABEL[action]}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_CATALOG.map(entry => (
            <tr key={entry.module}>
              <th scope="row">{entry.label}</th>
              {columns.map(action => (
                <td key={action}>
                  {entry.actions.includes(action) && (
                    <input
                      type="checkbox"
                      checked={has(value, entry.module, action)}
                      disabled={disabled}
                      onChange={() => onChange(togglePermission(value, entry.module, action))}
                      aria-label={`${entry.label}: ${ACTION_LABEL[action]}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
