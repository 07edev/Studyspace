import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQuery } from '../../../common/utils/page';
import { AttributeType, PlaceCategory } from '../place.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toBool = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class AttributeDefinitionsQueryDto extends PageQuery {
  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  active?: boolean;
}

export class AttributeDefinitionWriteDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/, {
    message: 'Mã thuộc tính chỉ gồm chữ thường, số và dấu gạch ngang (2-80 ký tự).',
  })
  key: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  @IsEnum(AttributeType)
  type: AttributeType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options?: string[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  unit?: string;

  @Type(() => Boolean)
  @IsBoolean()
  required: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  filterable: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  active: boolean;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;
}

export class AttributeDefinitionPatchDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/, {
    message: 'Mã thuộc tính chỉ gồm chữ thường, số và dấu gạch ngang (2-80 ký tự).',
  })
  key?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options?: string[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(PlaceCategory)
  category?: PlaceCategory;
}
