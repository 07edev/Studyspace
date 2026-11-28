import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { PageQuery } from '../../common/utils/page';
import { MajorsQuery, TaxonomySearchQuery, WardsQuery } from './dto/taxonomy.dto';
import { TaxonomyKind } from './schemas/taxonomy-item.schema';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('Taxonomy')
@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Public()
  @Get('taxonomies/place-categories')
  placeCategories(@Query() query: PageQuery) {
    return this.taxonomy.listByKind(TaxonomyKind.PLACE_CATEGORY, query);
  }

  @Public()
  @Get('taxonomies/amenities')
  amenities(@Query() query: PageQuery) {
    return this.taxonomy.listByKind(TaxonomyKind.AMENITY, query);
  }

  @Public()
  @Get('taxonomies/universities')
  universities(@Query() query: TaxonomySearchQuery) {
    return this.taxonomy.listByKind(TaxonomyKind.UNIVERSITY, query);
  }

  @Public()
  @Get('taxonomies/majors')
  majors(@Query() query: MajorsQuery) {
    return this.taxonomy.listMajors(query);
  }

  @Public()
  @Get('taxonomies/subjects')
  subjects(@Query() query: TaxonomySearchQuery) {
    return this.taxonomy.listByKind(TaxonomyKind.SUBJECT, query);
  }

  @Public()
  @Get('locations/provinces')
  provinces(@Query() query: PageQuery) {
    return this.taxonomy.listByKind(TaxonomyKind.PROVINCE, query);
  }

  @Public()
  @Get('locations/wards')
  wards(@Query() query: WardsQuery) {
    return this.taxonomy.listWards(query);
  }
}
