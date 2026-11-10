import type { AccountStatus, Role } from './api';

// Shapes returned by the backend auth endpoints (see backend/README.md and the G1 spec).
export type User = {
  id: string;
  email: string;
  phone?: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  authProviders: string[];
  profile: { displayName?: string } & Record<string, unknown>;
  createdAt: string;
  lastLoginAt?: string;
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
