import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiException } from '../../../common/api-error';
import {
  IS_OPTIONAL_AUTH,
  IS_PUBLIC,
  type RequestWithIdentity,
} from '../../../common/decorators/auth.decorators';
import { AccessTokenService } from '../access-token.service';
import { IdentityService } from '../identity.service';

const unauthorized = () =>
  new ApiException(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục.');

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    const optional = !!this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      targets,
    );
    const req = context.switchToHttp().getRequest<Request & RequestWithIdentity>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      if (optional) {
        return true;
      }
      throw unauthorized();
    }
    const payload = this.tokens.verify(token);
    if (!payload) {
      // A bad token is an error even on optional routes: the client should refresh.
      throw unauthorized();
    }
    req.identity = await this.identity.load(payload.sub, payload.sid);
    return true;
  }
}
