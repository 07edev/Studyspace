import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { PlaceUpsertDto } from '../../places/dto/admin-places.dto';
import { SuggestionStatus, SuggestionType } from '../place-suggestion.schema';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SuggestionChangeDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fieldPath: string;

  @IsDefined()
  newValue: unknown;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export class SuggestionCreateDto {
  @IsEnum(SuggestionType)
  type: SuggestionType;

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã địa điểm không hợp lệ.' })
  placeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceUpsertDto)
  proposedPlace?: PlaceUpsertDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SuggestionChangeDto)
  changes?: SuggestionChangeDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @Matches(OBJECT_ID, { each: true, message: 'Mã tệp bằng chứng không hợp lệ.' })
  evidenceFileIds?: string[];
}

export class AdminSuggestionsQueryDto extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(SuggestionType)
  type?: SuggestionType;

  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;
}

export class ModerationDecisionDto {
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
