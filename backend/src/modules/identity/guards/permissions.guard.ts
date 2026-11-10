import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../../../common/api-error';
import {
  REQUIRED_PERMISSION,
  SUPER_ADMIN_ONLY,
  type RequestWithIdentity,
} from '../../../common/decorators/auth.decorators';
import type { PermissionAction, PermissionModule } from '../../../common/enums';
import { Role } from '../../../common/enums';

const forbidden = () =>
  new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const superOnly = this.reflector.getAllAndOverride<boolean>(
      SUPER_ADMIN_ONLY,
      targets,
    );
    const required = this.reflector.getAllAndOverride<
      { module: PermissionModule; action: PermissionAction } | undefined
    >(REQUIRED_PERMISSION, targets);
    if (!superOnly && !required) {
      return true;
    }
    const identity = context
      .switchToHttp()
      .getRequest<RequestWithIdentity>().identity;
    if (!identity) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục.');
    }
    if (identity.role === Role.SUPER_ADMIN) {
      return true;
    }
    if (superOnly || identity.role !== Role.ADMIN || !required) {
      throw forbidden();
    }
    const allowed = identity.permissions.some(
      p => p.module === required.module && p.actions.includes(required.action),
    );
    if (!allowed) {
      throw forbidden();
    }
    return true;
  }
}
