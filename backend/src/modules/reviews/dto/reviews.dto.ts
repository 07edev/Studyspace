import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { ReviewStatus } from '../review.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReviewWriteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @Matches(OBJECT_ID, { each: true, message: 'Mã ảnh không hợp lệ.' })
  imageFileIds?: string[];
}

export class PlaceReviewsQueryDto extends PageQuery {
  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest', 'lowest'])
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}

export class AdminReviewsQueryDto extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã địa điểm không hợp lệ.' })
  placeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

export class ReviewModerateDto {
  @IsIn(['HIDE', 'RESTORE'])
  action: 'HIDE' | 'RESTORE';

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
