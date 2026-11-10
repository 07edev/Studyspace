import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiException, type FieldErrorDto } from '../api-error';
import type { RequestWithId } from '../middleware/request-id.middleware';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Yêu cầu không hợp lệ.',
  401: 'Bạn cần đăng nhập để tiếp tục.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy nội dung được yêu cầu.',
  405: 'Phương thức không được hỗ trợ.',
  409: 'Yêu cầu xung đột với dữ liệu hiện tại.',
  413: 'Dữ liệu gửi lên quá lớn.',
  415: 'Định dạng dữ liệu không được hỗ trợ.',
  422: 'Dữ liệu chưa hợp lệ.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<RequestWithId>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
    let details: FieldErrorDto[] | undefined;
    let retryAfterSeconds: number | undefined;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
      retryAfterSeconds = exception.retryAfterSeconds;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? 'HTTP_ERROR';
      // Nest's own messages are English ("Cannot GET /x", "Unauthorized"); the app shows
      // these to people, so use fixed Vietnamese text per status instead.
      message = STATUS_MESSAGES[status] ?? 'Chưa thể xử lý yêu cầu. Vui lòng thử lại.';
      if (status === 429) {
        retryAfterSeconds = 60;
      }
    } else {
      // Never leak internals to the client; log with the request id instead.
      this.logger.error(
        `${req.requestId} ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
    }
    if (retryAfterSeconds) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      },
      requestId: req.requestId,
    });
  }
}
