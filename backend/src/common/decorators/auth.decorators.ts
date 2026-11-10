import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { PermissionAction, PermissionModule } from '../enums';
import type { IdentityContext } from '../identity';

export const IS_PUBLIC = 'isPublic';
export const IS_OPTIONAL_AUTH = 'isOptionalAuth';
export const REQUIRED_PERMISSION = 'requiredPermission';
export const SUPER_ADMIN_ONLY = 'superAdminOnly';

// No authentication needed; any token sent is ignored.
export const Public = () => SetMetadata(IS_PUBLIC, true);
// PUBLIC_OR_OWNER style routes: identity is attached when a valid token is sent.
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH, true);
// Server-side permission check, e.g. @RequirePermission('USERS', 'READ').
export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
) => SetMetadata(REQUIRED_PERMISSION, { module, action });
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY, true);

export type RequestWithIdentity = { identity?: IdentityContext };

// Never read the actor from body/query; always use this.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): IdentityContext | undefined =>
    context.switchToHttp().getRequest<RequestWithIdentity>().identity,
);
