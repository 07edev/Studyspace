import type { User } from '../identity/schemas/user.schema';

const maskPhone = (phone?: string) =>
  phone ? `${phone.slice(0, 3)}${'*'.repeat(Math.max(0, phone.length - 5))}${phone.slice(-2)}` : undefined;

/**
 * What an admin may see about a user. Deliberately smaller than the user's own view: no date of
 * birth, bio, hometown or location, and the phone number is masked. Email stays visible because
 * admins need it to tell accounts apart.
 */
export function toAdminUserView(user: User & { _id: unknown }) {
  return {
    id: String(user._id),
    email: user.emailNormalized,
    phone: maskPhone(user.phoneNormalized),
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    authProviders: user.authProviders,
    profile: {
      displayName: user.profile?.displayName,
      universityId: user.profile?.universityId ? String(user.profile.universityId) : undefined,
      majorId: user.profile?.majorId ? String(user.profile.majorId) : undefined,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}
export type AdminUserView = ReturnType<typeof toAdminUserView>;
