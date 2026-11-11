import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminStatus } from '../../../common/enums';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const NAME = { message: 'Tên hiển thị cần từ 2 đến 100 ký tự.' };

// AdminCreate. Permissions are checked in the service (normalizePermissions) so a bad entry
// answers INVALID_PERMISSION with a precise message.
export class AdminCreateDto {
  @trim() @IsString() @MinLength(2, NAME) @MaxLength(100, NAME)
  displayName: string;

  @trim() @IsEmail() @MaxLength(254)
  email: string;

  @IsIn(['ADMIN'])
  role: 'ADMIN';

  @IsArray() @ArrayMaxSize(100)
  permissions: unknown[];
}

// AdminPatch. PUT /admin/admins/{id}/permissions reads only `permissions` and requires it.
export class AdminPatchDto {
  @IsOptional() @trim() @IsString() @MinLength(2, NAME) @MaxLength(100, NAME)
  displayName?: string;

  @IsOptional() @IsIn(Object.values(AdminStatus))
  status?: AdminStatus;

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  permissions?: unknown[];
}
