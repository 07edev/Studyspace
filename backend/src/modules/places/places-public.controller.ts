import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth, Public } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import {
  HomeQueryDto,
  PlacesFacetsQueryDto,
  PlacesMapQueryDto,
  PlacesPublicQueryDto,
} from './dto/places-public.dto';
import { PlacesPublicService } from './places-public.service';

@ApiTags('PlacesPublic')
@Controller()
export class PlacesPublicController {
  constructor(private readonly places: PlacesPublicService) {}

  @OptionalAuth()
  @Get('home')
  home(@Query() query: HomeQueryDto, @CurrentUser() user?: IdentityContext) {
    return this.places.home(query, user?.userId);
  }

  @OptionalAuth()
  @Get('places')
  list(@Query() query: PlacesPublicQueryDto, @CurrentUser() user?: IdentityContext) {
    return this.places.list(query, user?.userId);
  }

  @Public()
  @Get('places/map')
  map(@Query() query: PlacesMapQueryDto) {
    return this.places.map(query);
  }

  @Public()
  @Get('places/facets')
  facets(@Query() query: PlacesFacetsQueryDto) {
    return this.places.facets(query);
  }

  @OptionalAuth()
  @Get('places/:placeId')
  detail(@Param('placeId') placeId: string, @CurrentUser() user?: IdentityContext) {
    return this.places.detail(placeId, user?.userId);
  }

  @OptionalAuth()
  @Get('places/:placeId/similar')
  similar(
    @Param('placeId') placeId: string,
    @Query() query: PageQuery,
    @CurrentUser() user?: IdentityContext,
  ) {
    return this.places.similar(placeId, query, user?.userId);
  }
}
