import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { PostStatus } from '../post.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreatePostDto {
  @trim() @IsString() @MinLength(3) @MaxLength(160)
  title: string;

  @trim() @IsString() @MinLength(1) @MaxLength(20000)
  content: string;

  @IsOptional() @trim() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @Matches(OBJECT_ID, { each: true, message: 'Mã ảnh không hợp lệ.' })
  imageFileIds?: string[];

  @IsOptional() @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED])
  status?: PostStatus.DRAFT | PostStatus.PUBLISHED;
}

export class PatchPostDto {
  @IsOptional() @trim() @IsString() @MinLength(3) @MaxLength(160)
  title?: string;

  @IsOptional() @trim() @IsString() @MinLength(1) @MaxLength(20000)
  content?: string;

  @IsOptional() @trim() @IsString() @MaxLength(80)
  category?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @Matches(OBJECT_ID, { each: true, message: 'Mã ảnh không hợp lệ.' })
  imageFileIds?: string[];

  @IsOptional() @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED])
  status?: PostStatus.DRAFT | PostStatus.PUBLISHED;
}

export class PostsQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  authorId?: string;

  @IsOptional() @IsIn([PostStatus.DRAFT, PostStatus.PUBLISHED])
  status?: PostStatus.DRAFT | PostStatus.PUBLISHED;
}
