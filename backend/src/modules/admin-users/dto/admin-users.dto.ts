import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccountStatus, Role } from '../../../common/enums';
import { PageQuery } from '../../../common/utils/page';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// GET /admin/users filters.
export class AdminUserListQuery extends PageQuery {
  // Matches email or display name (case-insensitive, plain text) or an exact user id.
  @IsOptional() @trim() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsIn(Object.values(Role))
  role?: Role;

  @IsOptional() @IsIn(Object.values(AccountStatus))
  status?: AccountStatus;

  @IsOptional() @IsISO8601({ strict: true })
  createdFrom?: string;

  @IsOptional() @IsISO8601({ strict: true })
  createdTo?: string;

  @IsOptional() @IsIn(['createdAt', '-createdAt', 'lastLoginAt', '-lastLoginAt'])
  sort?: 'createdAt' | '-createdAt' | 'lastLoginAt' | '-lastLoginAt';
}

// AdminUserStatus
export class AdminUserStatusDto {
  @IsIn(['SUSPEND', 'UNSUSPEND'])
  action: 'SUSPEND' | 'UNSUSPEND';

  @trim() @IsString()
  @MinLength(10, { message: 'Lý do cần tối thiểu 10 ký tự.' })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự.' })
  reason: string;
}
