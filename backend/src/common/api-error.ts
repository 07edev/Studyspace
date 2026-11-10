import { HttpException } from '@nestjs/common';

export type FieldErrorDto = { field: string; rule: string; message: string };

// Business error carrying the spec error code (e.g. EMAIL_ALREADY_EXISTS).
export class ApiException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldErrorDto[],
    public readonly retryAfterSeconds?: number,
  ) {
    super({ code, message }, status);
  }
}
