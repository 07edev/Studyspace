import type { User } from '../identity/schemas/user.schema';

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

export const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: 'PUBLIC',
  showUniversity: true,
  showMajor: true,
};
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  postInteraction: true,
  moderation: true,
  adminMessage: true,
  system: true,
  pushEnabled: false,
};

type Stored = Pick<User, 'privacy' | 'notificationSettings'>;

// Always returns every field with the spec names. Reads the legacy `visibility` key that the
// first schema draft used, so older documents keep working.
export function privacyOf(user: Stored): PrivacySettings {
  const raw = (user.privacy ?? {}) as Record<string, unknown>;
  const visibility = raw.profileVisibility ?? raw.visibility;
  return {
    profileVisibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    showUniversity: typeof raw.showUniversity === 'boolean' ? raw.showUniversity : DEFAULT_PRIVACY.showUniversity,
    showMajor: typeof raw.showMajor === 'boolean' ? raw.showMajor : DEFAULT_PRIVACY.showMajor,
  };
}

export function notificationsOf(user: Stored): NotificationSettings {
  const raw = (user.notificationSettings ?? {}) as Record<string, unknown>;
  const pick = (key: keyof NotificationSettings) =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : DEFAULT_NOTIFICATIONS[key];
  return {
    postInteraction: pick('postInteraction'),
    moderation: pick('moderation'),
    adminMessage: pick('adminMessage'),
    system: pick('system'),
    pushEnabled: pick('pushEnabled'),
  };
}
