import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { PlaceCategory, QuietLevel, StudySuitability } from '../place.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toBool = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};
const toCsvList = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return value.flatMap(v => String(v).split(',')).map(s => s.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return undefined;
};

export const PLACE_PUBLIC_SORTS = ['DISTANCE', 'RATING', 'UPDATED', 'POPULAR'] as const;
export type PlacePublicSort = (typeof PLACE_PUBLIC_SORTS)[number];

export class HomeQueryDto {
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
}

export class PlacesPublicQueryDto extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  provinceCode?: string;

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
  @Max(50_000)
  radiusMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxPrice?: number;

  @IsOptional()
  @Transform(toCsvList)
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsEnum(QuietLevel)
  quietLevel?: QuietLevel;

  @IsOptional()
  @IsEnum(StudySuitability)
  studySuitability?: StudySuitability;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  openNow?: boolean;

  // JSON-encoded object or "defId:val,defId2:val2" string for dynamic attribute filtering
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  attributeFilters?: string;

  @IsOptional()
  @IsIn(PLACE_PUBLIC_SORTS)
  sort?: PlacePublicSort;
}

export class PlacesMapQueryDto extends PageQuery {
  // Format: minLng,minLat,maxLng,maxLat
  @Transform(trim)
  @IsString()
  bbox: string;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Transform(toCsvList)
  @IsString({ each: true })
  amenities?: string[];
}

export class PlacesFacetsQueryDto {
  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;
}
