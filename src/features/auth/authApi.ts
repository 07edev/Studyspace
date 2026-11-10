import type {
  AuthRegisterResult,
  AuthSession,
  ResetGrant,
  StatusMessage,
} from '../../shared/contracts/auth';
import type { SessionManager } from '../../shared/auth/sessionManager';

// Thin, typed wrappers over the public auth endpoints. Field names follow the G1 spec.
export const authApi = (session: SessionManager) => ({
  register: (body: {
    displayName: string;
    email: string;
    phone?: string;
    password: string;
    confirmPassword: string;
  }) =>
    session.publicRequest<AuthRegisterResult>('/auth/register', {
      method: 'POST',
      body,
    }),
  verifyEmail: (body: { email: string; otp: string }) =>
    session.publicRequest<AuthSession>('/auth/email/verify', {
      method: 'POST',
      body,
    }),
  resendEmailOtp: (email: string) =>
    session.publicRequest<StatusMessage>('/auth/email/resend-otp', {
      method: 'POST',
      body: { email },
    }),
  login: (body: { email: string; password: string }) =>
    session.publicRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: { ...body, client: 'MOBILE' },
    }),
  forgotPassword: (email: string) =>
    session.publicRequest<StatusMessage>('/auth/password/forgot', {
      method: 'POST',
      body: { email },
    }),
  verifyResetOtp: (body: { email: string; otp: string }) =>
    session.publicRequest<ResetGrant>('/auth/password/verify-otp', {
      method: 'POST',
      body,
    }),
  resetPassword: (body: {
    resetToken: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    session.publicRequest<StatusMessage>('/auth/password/reset', {
      method: 'POST',
      body,
    }),
});
