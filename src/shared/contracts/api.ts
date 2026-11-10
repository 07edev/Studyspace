export type FieldError = { field: string; rule: string; message: string };
export type ApiEnvelope<T> = { success: true; data: T; requestId: string };
export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: FieldError[];
    retryAfterSeconds?: number;
  };
  requestId: string;
};
export type Page<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
};
export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type AccountStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DELETION_REQUESTED'
  | 'DELETED';
export type Permission = { module: string; actions: string[] };
export type IdentityContext = {
  userId: string;
  role: Role;
  status: AccountStatus;
  permissions: Permission[];
};
export type PublicAuthor = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};
// Proposed integration contracts. Validate with domain owners before implementation.
export type AuditAction = {
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  before?: unknown;
  after?: unknown;
};
export type StatsContribution = {
  totalPlaces?: number;
  pendingSuggestions?: number;
  totalPosts?: number;
  pendingDocuments?: number;
  openReports?: number;
};
