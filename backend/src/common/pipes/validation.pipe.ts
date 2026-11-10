import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiException, type FieldErrorDto } from '../api-error';

const number = (message: string) => /(\d+)/.exec(message)?.[1] ?? '';

// Vietnamese messages per class-validator rule. `field` always carries the property name, so
// messages stay generic and the client can place them next to the right input.
const MESSAGES: Record<string, (original: string) => string> = {
  isString: () => 'Giá trị phải là chuỗi ký tự.',
  isNotEmpty: () => 'Không được để trống.',
  isEmail: () => 'Email không hợp lệ.',
  isBoolean: () => 'Giá trị phải là đúng hoặc sai.',
  isIn: () => 'Giá trị không nằm trong danh sách cho phép.',
  isInt: () => 'Giá trị phải là số nguyên.',
  isNumber: () => 'Giá trị phải là số.',
  isEnum: () => 'Giá trị không hợp lệ.',
  isArray: () => 'Giá trị phải là danh sách.',
  isDateString: () => 'Ngày giờ không hợp lệ.',
  isUrl: () => 'Đường dẫn không hợp lệ.',
  minLength: m => `Cần tối thiểu ${number(m)} ký tự.`,
  maxLength: m => `Tối đa ${number(m)} ký tự.`,
  min: m => `Giá trị tối thiểu là ${number(m)}.`,
  max: m => `Giá trị tối đa là ${number(m)}.`,
  matches: () => 'Giá trị không đúng định dạng.',
  whitelistValidation: () => 'Trường này không được hỗ trợ.',
};

// Default class-validator messages always contain the property name ("email must be an
// email"); messages we wrote ourselves in the DTOs (already Vietnamese) do not.
function translate(error: ValidationError, rule: string, original: string): string {
  const isDefault = original.includes(error.property);
  if (!isDefault) {
    return original;
  }
  return MESSAGES[rule]?.(original) ?? 'Giá trị không hợp lệ.';
}

function flatten(errors: ValidationError[], parent = ''): FieldErrorDto[] {
  return errors.flatMap(error => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([rule, message]) => ({
      field,
      rule,
      message: translate(error, rule, message),
    }));
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
      new ApiException(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', flatten(errors)),
  });
