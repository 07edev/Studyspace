import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PageQuery } from '../../../common/utils/page';

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class TaxonomySearchQuery extends PageQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class MajorsQuery extends TaxonomySearchQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(OBJECT_ID, { message: 'Mã trường đại học không hợp lệ.' })
  universityId?: string;
}

export class WardsQuery extends TaxonomySearchQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  provinceCode?: string;
}
