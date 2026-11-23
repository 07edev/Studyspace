import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { PostStatus } from '../post.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreatePostDto {
  @IsOptional() @trim() @IsString() @MinLength(5) @MaxLength(180)
  title?: string;

  @IsOptional() @trim() @IsString() @MinLength(1) @MaxLength(10000)
  content?: string;

  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(80)
  category?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  subjectIds?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique()
  @IsString({ each: true }) @MaxLength(80, { each: true })
  tags?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  imageFileIds?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  documentIds?: string[];

  @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED])
  status: PostStatus.DRAFT | PostStatus.PUBLISHED;
}

export class PatchPostDto {
  @IsOptional() @trim() @IsString() @MinLength(5) @MaxLength(180)
  title?: string;

  @IsOptional() @trim() @IsString() @MinLength(1) @MaxLength(10000)
  content?: string;

  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(80)
  category?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  subjectIds?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique()
  @IsString({ each: true }) @MaxLength(80, { each: true })
  tags?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  imageFileIds?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(OBJECT_ID, { each: true })
  documentIds?: string[];

  @IsOptional() @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED])
  status?: PostStatus.DRAFT | PostStatus.PUBLISHED;
}

export class PostsQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  subjectId?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  authorId?: string;

  @IsOptional() @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.HIDDEN])
  status?: PostStatus.DRAFT | PostStatus.PUBLISHED | PostStatus.HIDDEN;

  @IsOptional() @IsIn(['NEWEST', 'POPULAR'])
  sort?: 'NEWEST' | 'POPULAR';
}

export class PostModerationDto {
  @IsIn(['HIDE', 'RESTORE'])
  action: 'HIDE' | 'RESTORE';

  @trim() @IsString() @MinLength(10) @MaxLength(1000)
  reason: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedVersion: number;
}
