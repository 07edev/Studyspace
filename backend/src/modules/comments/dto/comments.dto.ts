import { Transform, Type } from 'class-transformer';
import {
  IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { CommentStatus } from '../comment.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreateCommentDto {
  @trim() @IsString() @MinLength(1) @MaxLength(2000)
  content: string;

  @IsOptional() @IsString() @Matches(OBJECT_ID)
  parentId?: string;
}

export class PatchCommentDto {
  @trim() @IsString() @MinLength(1) @MaxLength(2000)
  content: string;
}

export class CommentsQuery extends PageQuery {
  @IsOptional() @IsString() @Matches(OBJECT_ID)
  parentId?: string;
}

export class AdminCommentsQuery extends PageQuery {
  @IsOptional() @IsString() @Matches(OBJECT_ID)
  postId?: string;

  @IsOptional() @IsIn(Object.values(CommentStatus))
  status?: CommentStatus;
}

export class CommentModerationDto {
  @IsIn(['HIDE', 'RESTORE'])
  action: 'HIDE' | 'RESTORE';

  @trim() @IsString() @MinLength(10) @MaxLength(1000)
  reason: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000)
  expectedVersion: number;
}
