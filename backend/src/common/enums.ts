// Enums follow the ERD / G1 spec exactly. Do not add values without updating the spec.
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETION_REQUESTED = 'DELETION_REQUESTED',
  DELETED = 'DELETED',
}

export enum AdminStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export const PERMISSION_MODULES = [
  'USERS',
  'ADMINS',
  'PLACES',
  'SUGGESTIONS',
  'REVIEWS',
  'POSTS',
  'COMMENTS',
  'DOCUMENTS',
  'REPORTS',
  'STATISTICS',
  'AUDIT',
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

// Actions seen in the spec scopes (e.g. USERS.READ, REPORTS.ASSIGN).
export const PERMISSION_ACTIONS = [
  'READ',
  'CREATE',
  'UPDATE',
  'DELETE',
  'MODERATE',
  'ASSIGN',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type Permission = { module: PermissionModule; actions: PermissionAction[] };
