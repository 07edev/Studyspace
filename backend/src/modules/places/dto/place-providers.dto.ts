import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { PlaceCategory } from '../place.enums';
import { AddressDto, GeoPointDto } from './admin-places.dto';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toCsvUpper = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value.flatMap(v => String(v).split(',')).map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  return undefined;
};

export const EXTERNAL_PROVIDERS = ['OSM', 'WIKIDATA', 'GOOGLE_PLACES'] as const;
export type ExternalProviderName = (typeof EXTERNAL_PROVIDERS)[number];

export class PlaceCandidatesSearchQueryDto extends PageQuery {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(25_000)
  radiusMeters?: number;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Transform(toCsvUpper)
  @IsIn(EXTERNAL_PROVIDERS, { each: true })
  providers?: ExternalProviderName[];
}

export class DuplicateCheckDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID, { message: 'excludePlaceId không hợp lệ.' })
  excludePlaceId?: string;
}
