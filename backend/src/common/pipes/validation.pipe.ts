import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiException, type FieldErrorDto } from '../api-error';

function flatten(errors: ValidationError[], parent = ''): FieldErrorDto[] {
  return errors.flatMap(error => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(
      ([rule, message]) => ({ field, rule, message }),
    );
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

// 422 with details[{field,rule,message}] as required by the G1 error contract.
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: errors =>
      new ApiException(
        422,
        'VALIDATION_ERROR',
        'Dữ liệu chưa hợp lệ.',
        flatten(errors),
      ),
  });
