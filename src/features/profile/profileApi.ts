import type {
  ContactChallenge,
  NotificationSettings,
  PrivacySettings,
  ProfilePatch,
  StatusMessage,
  User,
} from '../../shared/contracts/auth';
import type { SessionManager } from '../../shared/auth/sessionManager';

// Typed wrappers over the signed-in endpoints (/users/me/*, /auth/*). Field names follow the G1 spec.
export const profileApi = (session: SessionManager) => ({
  me: () => session.request<User>('/users/me'),
  patchProfile: (body: ProfilePatch) =>
    session.request<User>('/users/me/profile', { method: 'PATCH', body }),
  getPrivacy: () => session.request<PrivacySettings>('/users/me/privacy'),
  patchPrivacy: (body: Partial<PrivacySettings>) =>
    session.request<PrivacySettings>('/users/me/privacy', { method: 'PATCH', body }),
  getNotificationSettings: () =>
    session.request<NotificationSettings>('/users/me/notification-settings'),
  patchNotificationSettings: (body: Partial<NotificationSettings>) =>
    session.request<NotificationSettings>('/users/me/notification-settings', {
      method: 'PATCH',
      body,
    }),
  requestContactChange: (body: { channel: 'EMAIL' | 'PHONE'; newValue: string }) =>
    session.request<ContactChallenge>('/auth/contact/change-request', {
      method: 'POST',
      body,
    }),
  confirmContactChange: (body: { challengeId: string; otp: string }) =>
    session.request<User>('/auth/contact/change-confirm', { method: 'POST', body }),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => session.request<StatusMessage>('/auth/password/change', { method: 'POST', body }),
  requestDeletion: (body: { confirm: boolean; password?: string; reason?: string }) =>
    session.request<StatusMessage>('/auth/account/deletion-requests', {
      method: 'POST',
      body,
    }),
});
