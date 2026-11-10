import type { AccountStatus, Permission, Role } from './enums';

// Matches the IdentityContext interface shared with TV2/TV3.
// Modules must take the actor from here, never from the request body.
export type IdentityContext = {
  userId: string;
  role: Role;
  status: AccountStatus;
  permissions: Permission[];
};
