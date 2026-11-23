import { Transform, Type } from 'class-transformer';
import {
  Equals, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { DocumentFormat, DocumentStatus, DocumentVisibility } from '../document.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class DocumentWriteDto {
  @trim() @IsString() @MinLength(3) @MaxLength(200)
  title: string;

  @IsOptional() @trim() @IsString() @MaxLength(3000)
  description?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  subjectId?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  majorId?: string;

  @trim() @IsString() @MinLength(2) @MaxLength(80)
  category: string;

  @IsString() @Matches(OBJECT_ID)
  fileId: string;

  @IsEnum(DocumentVisibility)
  visibility: DocumentVisibility;

  @Equals(true)
  shareRightsConfirmed: boolean;
}

export class DocumentsQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  subjectId?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  majorId?: string;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @IsEnum(DocumentFormat)
  format?: DocumentFormat;

  @IsOptional() @IsIn(['NEWEST', 'POPULAR'])
  sort?: 'NEWEST' | 'POPULAR';

  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class DocumentModerationDto {
  @IsIn(['APPROVE', 'REJECT', 'HIDE'])
  action: 'APPROVE' | 'REJECT' | 'HIDE';

  @ValidateIf(dto => dto.action !== 'APPROVE')
  @IsString() @MinLength(10) @MaxLength(1000)
  reason?: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedVersion: number;
}
