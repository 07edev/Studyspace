import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';
import { ApiException } from '../../common/api-error';
import type { RequestWithIdentity } from '../../common/decorators/auth.decorators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly service: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & RequestWithIdentity>();
    const key = req.header('Idempotency-Key')?.trim();
    if (!key || key.length < 8 || key.length > 128) {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Thiếu Idempotency-Key hợp lệ.', [
        {
          field: 'Idempotency-Key',
          rule: 'required',
          message: 'Header Idempotency-Key (8-128 ký tự) là bắt buộc.',
        },
      ]);
    }
    const actorId = req.identity?.userId;
    if (!actorId) {
      throw new ApiException(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục.');
    }
    const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
    return from(this.service.begin(actorId, route, key, req.body)).pipe(
      mergeMap(state =>
        state.replay
          ? of(state.response)
          : next.handle().pipe(
              mergeMap(async data => {
                await this.service.complete(actorId, route, key, data);
                return data;
              }),
              catchError(error =>
                from(this.service.abort(actorId, route, key)).pipe(
                  mergeMap(() => throwError(() => error)),
                ),
              ),
            ),
      ),
    );
  }
}

// Usage: @Idempotent() on mutation routes that must not run twice (approve, create...).
export const Idempotent = () => applyDecorators(UseInterceptors(IdempotencyInterceptor));
