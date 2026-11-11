import type { AccountStatus, Permission, Role } from './api';

// Shapes returned by the admin endpoints (backend/src/modules/admin-users, admin-admins).
// Used by the web admin; kept here so every client shares one definition.

/** What an admin sees about a user: no birth date, bio or location; phone is masked. */
export type AdminUserView = {
  id: string;
  email: string;
  phone?: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  authProviders: string[];
  profile: { displayName?: string; universityId?: string; majorId?: string };
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
};

export type AuditEvent = {
  id: string;
  actorId?: string;
  actorType: 'SYSTEM' | 'USER' | 'ADMIN';
  action: string;
  resourceType: string;
  resourceId?: string;
  // Already redacted by the server.
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestId: string;
  createdAt: string;
};

/**
 * Counts are left out while the team that owns the data is not connected yet:
 * `undefined` means "not available", never zero.
 */
export type UserAdminDetail = {
  user: AdminUserView;
  postCount?: number;
  documentCount?: number;
  reviewCount?: number;
  suggestionCount?: number;
  moderationHistory: AuditEvent[];
};

export type AdminUserStatusBody = { action: 'SUSPEND' | 'UNSUSPEND'; reason: string };

export type AdminStatus = 'ACTIVE' | 'DISABLED';
export type Admin = {
  id: string; // the user id
  email: string;
  displayName: string;
  role: Role;
  status: AdminStatus;
  permissions: Permission[];
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
};
/** POST /admin/admins also says whether the invitation email went out. */
export type AdminCreated = Admin & { invitationSent: boolean };
export type AdminCreateBody = {
  displayName: string;
  email: string;
  role: 'ADMIN';
  permissions: Permission[];
};
export type AdminPatchBody = {
  displayName?: string;
  status?: AdminStatus;
  permissions?: Permission[];
};

// ---- Audit log (GET /admin/audit-logs) ----
/** AuditEvent plus who did it, when the actor is an account (SYSTEM events have none). */
export type AuditEntry = AuditEvent & { actor?: { displayName?: string; email?: string } };

// ---- Statistics (GET /admin/dashboard, /admin/statistics/*) ----
/**
 * Fields other teams own (places, posts, documents, reports) are ABSENT until that team is
 * connected: absent means "not available", never zero.
 */
export type DashboardStats = {
  totalUsers: number;
  newUsers: number;
  totalPlaces?: number;
  placesByCategory?: Record<string, number>;
  pendingSuggestions?: number;
  totalPosts?: number;
  totalDocuments?: number;
  pendingDocuments?: number;
  openReports?: number;
  range: { from: string; to: string }; // YYYY-MM-DD, Vietnam time, inclusive
  /** Sources that did not answer; their numbers are missing from this response. */
  failedSources?: string[];
};

export type ActivitySeries = 'users' | 'places' | 'posts' | 'documents' | 'reports';
export type TimelinePoint = { date: string } & Partial<Record<ActivitySeries, number>>;
export type Granularity = 'DAY' | 'WEEK' | 'MONTH';
export type ActivityStats = {
  items: TimelinePoint[]; // every day/week/month in range, zero-filled, oldest first
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
  granularity: Granularity;
  range: { from: string; to: string };
  /** Series that have data. A series nobody provides yet is not listed. */
  series: ActivitySeries[];
  failedSources?: string[];
};
