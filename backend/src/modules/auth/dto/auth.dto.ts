import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';
import { passwordProblems } from '../password.service';

// DTO names and rules follow the REST spec. Register validates password strength here
// (VALIDATION_ERROR); reset/change check it in the service so they can return WEAK_PASSWORD.
const PHONE = /^\+?[1-9][0-9]{7,14}$/;
const OTP = /^[0-9]{6}$/;
const CLIENTS = ['WEB_ADMIN', 'MOBILE'] as const;

// Reported together with the other field errors so the user fixes everything in one go.
const StrongPassword = () =>
  ValidateBy({
    name: 'strength',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && passwordProblems(value).length === 0,
      defaultMessage: (args?: ValidationArguments) => passwordProblems(String(args?.value ?? '')).join(' '),
    },
  });
const SameAs = (other: string) =>
  ValidateBy({
    name: 'match',
    constraints: [other],
    validator: {
      validate: (value: unknown, args?: ValidationArguments) =>
        value === (args?.object as Record<string, unknown>)[args?.constraints[0]],
      defaultMessage: () => 'Mật khẩu xác nhận không khớp.',
    },
  });
// "+84 901-234-567" is what people type; the stored/validated form is digits only.
const stripPhone = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value));

class Passwordish {
  @IsString() @MinLength(1) @MaxLength(72)
  password: string;
}

export class AuthRegister {
  @IsString() @MinLength(2) @MaxLength(100)
  displayName: string;

  @IsEmail() @MaxLength(254)
  email: string;

  @IsOptional() @stripPhone() @Matches(PHONE, { message: 'Số điện thoại không hợp lệ.' })
  phone?: string;

  @IsString() @MaxLength(72) @StrongPassword()
  password: string;

  @IsString() @MaxLength(72) @SameAs('password')
  confirmPassword: string;
}

export class AuthLogin extends Passwordish {
  @IsEmail() @MaxLength(254)
  email: string;

  @IsIn(CLIENTS)
  client: (typeof CLIENTS)[number];
}

export class OtpRequest {
  @IsEmail() @MaxLength(254)
  email: string;
}

export class OtpVerify {
  @IsEmail() @MaxLength(254)
  email: string;

  @Matches(OTP, { message: 'Mã OTP gồm 6 chữ số.' })
  otp: string;
}

export class GoogleLogin {
  @IsString() @MinLength(30) @MaxLength(5000)
  idToken: string;

  @IsIn(['MOBILE'])
  client: 'MOBILE';
}

export class TokenRefresh {
  @IsOptional() @IsString() @MinLength(20) @MaxLength(1000)
  refreshToken?: string;

  @IsIn(CLIENTS)
  client: (typeof CLIENTS)[number];
}

export class ResetPassword {
  @IsString() @MinLength(20) @MaxLength(1000)
  resetToken: string;

  @IsString() @MaxLength(72)
  newPassword: string;

  @IsString() @MaxLength(72)
  confirmPassword: string;
}

export class ChangePassword {
  @IsString() @MinLength(1) @MaxLength(72)
  currentPassword: string;

  @IsString() @MaxLength(72)
  newPassword: string;

  @IsString() @MaxLength(72)
  confirmPassword: string;
}

export class ContactChangeRequest {
  @IsIn(['EMAIL', 'PHONE'])
  channel: 'EMAIL' | 'PHONE';

  @IsString() @MinLength(8) @MaxLength(254)
  value: string;
}

export class ContactChangeConfirm {
  @IsString() @Matches(/^[a-fA-F0-9]{24}$/)
  challengeId: string;

  @Matches(OTP, { message: 'Mã OTP gồm 6 chữ số.' })
  otp: string;
}

export class AccountDeleteRequest {
  @IsOptional() @IsString() @MaxLength(72)
  password?: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;

  @IsBoolean()
  confirm: boolean;
}
