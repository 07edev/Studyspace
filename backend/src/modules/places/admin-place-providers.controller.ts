import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import {
  DuplicateCheckDto,
  PlaceCandidatesSearchQueryDto,
} from './dto/place-providers.dto';
import { DuplicateCheckService } from './providers/duplicate-check.service';
import { PlaceProvidersService } from './providers/place-providers.service';

@ApiTags('AdminPlaces')
@Controller('admin')
export class AdminPlaceProvidersController {
  constructor(
    private readonly providers: PlaceProvidersService,
    private readonly duplicateCheck: DuplicateCheckService,
  ) {}

  // Protect external OSM/Wikidata/Google endpoints with stricter rate limit.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @RequirePermission('PLACES', 'CREATE')
  @Get('place-candidates/search')
  searchCandidates(@Query() query: PlaceCandidatesSearchQueryDto) {
    return this.providers.searchCandidates(query);
  }

  @RequirePermission('PLACES', 'CREATE')
  @HttpCode(200)
  @Post('places/duplicate-check')
  checkDuplicate(@Body() dto: DuplicateCheckDto) {
    return this.duplicateCheck.check(dto);
  }
}
