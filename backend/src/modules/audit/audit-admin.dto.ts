import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PageQuery } from '../../common/utils/page';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const ID_MESSAGE = 'Mã không hợp lệ.';
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// GET /admin/audit-logs filters (spec: actorId, action, resourceType, from, to, page, limit;
// resourceId, actorType and requestId added to follow one object or one request through the log).
export class AuditLogQuery extends PageQuery {
  @IsOptional() @Matches(OBJECT_ID, { message: ID_MESSAGE })
  actorId?: string;

  @IsOptional() @IsIn(['SYSTEM', 'USER', 'ADMIN'])
  actorType?: 'SYSTEM' | 'USER' | 'ADMIN';

  // Matches any action that contains this text, ignoring case (plain text, not a pattern).
  @IsOptional() @trim() @IsString() @MaxLength(120)
  action?: string;

  @IsOptional() @trim() @IsString() @MaxLength(100)
  resourceType?: string;

  @IsOptional() @Matches(OBJECT_ID, { message: ID_MESSAGE })
  resourceId?: string;

  @IsOptional() @trim() @IsString() @MaxLength(80)
  requestId?: string;

  @IsOptional() @IsISO8601({ strict: true })
  from?: string;

  @IsOptional() @IsISO8601({ strict: true })
  to?: string;
}
