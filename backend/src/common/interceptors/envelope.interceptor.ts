import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { RequestWithId } from '../middleware/request-id.middleware';

// Wraps successful results as { success: true, data, requestId }. 204 stays empty.
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      map(data =>
        res.statusCode === 204
          ? undefined
          : { success: true, data: data ?? null, requestId: req.requestId },
      ),
    );
  }
}
