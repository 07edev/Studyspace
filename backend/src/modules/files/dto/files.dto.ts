import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { FilePurpose } from '../file.schema';

const SHA256 = /^[a-fA-F0-9]{64}$/;
const CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
] as const;

export class FileUploadInitDto {
  @IsEnum(FilePurpose)
  purpose: FilePurpose;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(255)
  fileName: string;

  @IsString() @IsIn(CONTENT_TYPES)
  contentType: (typeof CONTENT_TYPES)[number];

  @Type(() => Number) @IsInt() @Min(1) @Max(20_000_000)
  sizeBytes: number;

  @IsOptional() @IsString() @Matches(SHA256)
  checksumSha256?: string;
}
