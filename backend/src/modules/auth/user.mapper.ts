import type { User } from '../identity/schemas/user.schema';

// API User DTO. Never exposes _id, passwordHash or internal fields.
export function toUserDto(user: User & { _id: unknown }) {
  return {
    id: String(user._id),
    email: user.emailNormalized,
    phone: user.phoneNormalized,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    authProviders: user.authProviders,
    profile: user.profile,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
export type UserDto = ReturnType<typeof toUserDto>;
