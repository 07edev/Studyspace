import { ApiException } from '../../common/api-error';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type Permission,
  type PermissionAction,
  type PermissionModule,
} from '../../common/enums';

// Modules an ADMIN can be given. ADMINS (managing other admins) is Super Admin only: the
// endpoints refuse everyone else, so granting it would look like a power it does not give.
export const ASSIGNABLE_MODULES = PERMISSION_MODULES.filter(m => m !== 'ADMINS');

const invalid = (message: string) =>
  new ApiException(422, 'INVALID_PERMISSION', message, [
    { field: 'permissions', rule: 'invalid', message },
  ]);

/**
 * Checks a permissions list from the request and returns it in a canonical form (modules in the
 * spec order, actions in the spec order, no duplicates). Anything unknown is refused, never
 * silently dropped, so a typo cannot quietly grant or remove access.
 */
export function normalizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) {
    throw invalid('Danh sách quyền không hợp lệ.');
  }
  const byModule = new Map<PermissionModule, Set<PermissionAction>>();
  for (const item of input) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw invalid('Mỗi quyền cần có module và danh sách thao tác.');
    }
    const { module, actions, ...extra } = item as Record<string, unknown>;
    if (Object.keys(extra).length > 0) {
      throw invalid('Quyền chứa trường không được hỗ trợ.');
    }
    if (typeof module !== 'string' || !(PERMISSION_MODULES as readonly string[]).includes(module)) {
      throw invalid(`Module "${String(module)}" không tồn tại.`);
    }
    if (!(ASSIGNABLE_MODULES as readonly string[]).includes(module)) {
      throw invalid('Quyền quản lý Admin chỉ dành cho Super Admin.');
    }
    if (byModule.has(module as PermissionModule)) {
      throw invalid(`Module ${module} bị khai báo nhiều lần.`);
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      throw invalid(`Module ${module} cần ít nhất một thao tác.`);
    }
    const set = new Set<PermissionAction>();
    for (const action of actions) {
      if (typeof action !== 'string' || !(PERMISSION_ACTIONS as readonly string[]).includes(action)) {
        throw invalid(`Thao tác "${String(action)}" không tồn tại.`);
      }
      if (set.has(action as PermissionAction)) {
        throw invalid(`Thao tác ${action} của module ${module} bị trùng.`);
      }
      set.add(action as PermissionAction);
    }
    byModule.set(module as PermissionModule, set);
  }
  return PERMISSION_MODULES.filter(m => byModule.has(m)).map(module => ({
    module,
    actions: PERMISSION_ACTIONS.filter(a => byModule.get(module)!.has(a)),
  }));
}
