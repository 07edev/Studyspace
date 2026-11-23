import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { ReportReasonCode, ReportStatus, ReportTargetType } from '../report.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsString()
  @Matches(OBJECT_ID)
  targetId: string;

  @IsEnum(ReportReasonCode)
  reasonCode: ReportReasonCode;

  @IsOptional() @trim() @IsString() @MinLength(10)
  description?: string;

  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(5)
  @IsString({ each: true }) @Matches(OBJECT_ID, { each: true })
  evidenceFileIds?: string[];
}

export class ReportsQuery extends PageQuery {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;

  @IsOptional()
  @IsEnum(ReportReasonCode)
  reasonCode?: ReportReasonCode;
}

export class ReportAssignmentDto {
  @IsString()
  @Matches(OBJECT_ID)
  assigneeId: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedVersion: number;
}

export class ReportDecisionDto {
  @IsIn(['TAKE_DOWN', 'NO_VIOLATION'])
  action: 'TAKE_DOWN' | 'NO_VIOLATION';

  @trim() @IsString() @MinLength(10)
  reason: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedVersion: number;

  @ValidateIf(dto => dto.action === 'TAKE_DOWN')
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedTargetVersion?: number;
}
