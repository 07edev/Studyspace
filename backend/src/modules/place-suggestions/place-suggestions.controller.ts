import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import { Idempotent } from '../idempotency/idempotency.interceptor';
import { DuplicateCheckDto } from '../places/dto/place-providers.dto';
import { SuggestionCreateDto } from './dto/place-suggestions.dto';
import { PlaceSuggestionsService } from './place-suggestions.service';

@ApiTags('PlaceSuggestions')
@Controller()
export class PlaceSuggestionsController {
  constructor(private readonly suggestions: PlaceSuggestionsService) {}

  @HttpCode(200)
  @Post('place-suggestions/duplicate-check')
  duplicateCheck(@Body() dto: DuplicateCheckDto) {
    return this.suggestions.checkDuplicate(dto);
  }

  @Idempotent()
  @Post('place-suggestions')
  create(@CurrentUser() actor: IdentityContext, @Body() dto: SuggestionCreateDto) {
    return this.suggestions.create(actor, dto);
  }

  @Get('users/me/place-suggestions')
  listMine(@CurrentUser() actor: IdentityContext, @Query() query: PageQuery) {
    return this.suggestions.listMine(actor.userId, query);
  }

  @Get('users/me/place-suggestions/:suggestionId')
  detailMine(
    @CurrentUser() actor: IdentityContext,
    @Param('suggestionId') suggestionId: string,
  ) {
    return this.suggestions.detailMine(actor.userId, suggestionId);
  }
}
