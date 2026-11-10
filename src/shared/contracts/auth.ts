import type { AccountStatus, Permission, Role } from './api';

// Shapes returned by the backend auth endpoints (see backend/README.md and the G1 spec).
export type GeoPoint = { lat: number; lng: number };
export type Profile = {
  displayName?: string;
  avatarFileId?: string;
  avatarUrl?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  hometown?: string;
  bio?: string;
  universityId?: string;
  majorId?: string;
  subjectIds?: string[];
  locationMode?: 'MANUAL' | 'CURRENT_LOCATION';
  location?: GeoPoint;
};
export type User = {
  id: string;
  email: string;
  phone?: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  authProviders: string[];
  profile: Profile;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  // Only for ADMIN / SUPER_ADMIN (login and GET /auth/me): drives which menus the web admin shows.
  admin?: { status: 'ACTIVE' | 'DISABLED'; permissions: Permission[] };
};
// Body of PATCH /users/me/profile: send only what changes; null clears an optional field.
export type ProfilePatch = {
  [K in keyof Omit<Profile, 'avatarUrl'>]?: Profile[K] | null;
};
export type PrivacySettings = {
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  showUniversity: boolean;
  showMajor: boolean;
};
export type NotificationSettings = {
  postInteraction: boolean;
  moderation: boolean;
  adminMessage: boolean;
  system: boolean;
  pushEnabled: boolean;
};
export type ContactChallenge = {
  challengeId: string;
  deliveryChannel: 'EMAIL' | 'PHONE';
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt?: string;
};
export type AccessTokens = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  // Mobile only; the web admin keeps it in an HttpOnly cookie instead.
  refreshToken?: string;
};
export type AuthSession = { user: User; tokens: AccessTokens };
export type StatusMessage = { message: string };
export type AuthRegisterResult = {
  email: string;
  status: AccountStatus;
  otpExpiresAt: string;
  resendAvailableAt?: string;
};
export type ResetGrant = { resetToken: string; expiresInSeconds: number };
