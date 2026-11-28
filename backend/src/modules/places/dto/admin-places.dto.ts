import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import {
  DayOfWeek,
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../place.enums';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const PHONE_E164 = /^\+?[1-9][0-9]{7,14}$/;
const FIELD_PATH_RE = /^[a-zA-Z][a-zA-Z0-9_.\[\]]*$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GeoPointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class AddressDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  line1: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  wardCode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  districtCode?: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  provinceCode: string;

  @IsIn(['VN'])
  countryCode: 'VN';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(400)
  displayText?: string;
}

export class OpeningIntervalDto {
  @IsString()
  @Matches(HHMM_RE, { message: 'Giờ mở cửa phải theo định dạng HH:mm.' })
  open: string;

  @IsString()
  @Matches(HHMM_RE, { message: 'Giờ đóng cửa phải theo định dạng HH:mm.' })
  close: string;

  @IsOptional()
  @IsBoolean()
  overnight?: boolean;
}

export class OpeningDayDto {
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @IsBoolean()
  closed: boolean;

  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OpeningIntervalDto)
  intervals: OpeningIntervalDto[];
}

export class PriceRangeDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minVnd: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxVnd: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsIn(['VND'])
  currency: 'VND';
}

export class AttributeValueDto {
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã định nghĩa thuộc tính không hợp lệ.' })
  definitionId: string;

  @IsDefined()
  value: string | number | boolean | string[];
}

export class AdminPlacesQueryDto extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @IsEnum(PlaceOrigin)
  origin?: PlaceOrigin;

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;
}

export class PlaceUpsertDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsEnum(PlaceCategory)
  category: PlaceCategory;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_E164, { message: 'Số điện thoại phải đúng định dạng E.164 (vd: +84901234567).' })
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Matches(OBJECT_ID, { each: true, message: 'Mã ảnh không hợp lệ.' })
  imageFileIds?: string[];

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã ảnh bìa không hợp lệ.' })
  coverFileId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningDayDto)
  hours?: OpeningDayDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  price?: PriceRangeDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  amenities?: string[];

  @IsOptional()
  @IsEnum(QuietLevel)
  quietLevel?: QuietLevel;

  @IsOptional()
  @IsEnum(StudySuitability)
  studySuitability?: StudySuitability;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  attributes?: AttributeValueDto[];

  @IsEnum(PlaceOrigin)
  origin: PlaceOrigin;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  importCandidateToken?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  sourceLinkId?: string;

  @IsOptional()
  @IsEnum(PlaceStatus)
  status?: PlaceStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  duplicateOverrideReason?: string;
}

export class PlacePatchDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_E164, { message: 'Số điện thoại phải đúng định dạng E.164.' })
  phone?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Matches(OBJECT_ID, { each: true, message: 'Mã ảnh không hợp lệ.' })
  imageFileIds?: string[];

  @IsOptional()
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã ảnh bìa không hợp lệ.' })
  coverFileId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningDayDto)
  hours?: OpeningDayDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  price?: PriceRangeDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  amenities?: string[];

  @IsOptional()
  @IsEnum(QuietLevel)
  quietLevel?: QuietLevel;

  @IsOptional()
  @IsEnum(StudySuitability)
  studySuitability?: StudySuitability;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  attributes?: AttributeValueDto[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class PlaceStatusPatchDto {
  @IsIn([PlaceStatus.PUBLISHED, PlaceStatus.HIDDEN, PlaceStatus.DELETED])
  status: PlaceStatus.PUBLISHED | PlaceStatus.HIDDEN | PlaceStatus.DELETED;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export class FieldDecisionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(FIELD_PATH_RE, { message: 'Đường dẫn trường dữ liệu không hợp lệ.' })
  path: string;

  @IsOptional()
  @IsIn(['LOCK', 'UNLOCK'])
  action?: 'LOCK' | 'UNLOCK';

  @IsOptional()
  @IsEnum(FieldVerifiedStatus)
  verified?: FieldVerifiedStatus;

  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
