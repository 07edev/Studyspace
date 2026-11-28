import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { Idempotent } from '../idempotency/idempotency.interceptor';
import {
  AdminSuggestionsQueryDto,
  ModerationDecisionDto,
} from './dto/place-suggestions.dto';
import { PlaceSuggestionsService } from './place-suggestions.service';

type ReqWithId = Request & { requestId?: string };

@ApiTags('AdminSuggestions')
@Controller('admin/place-suggestions')
export class AdminSuggestionsController {
  constructor(private readonly suggestions: PlaceSuggestionsService) {}

  @RequirePermission('SUGGESTIONS', 'READ')
  @Get()
  list(@Query() query: AdminSuggestionsQueryDto) {
    return this.suggestions.listAdmin(query);
  }

  @RequirePermission('SUGGESTIONS', 'READ')
  @Get(':suggestionId')
  detail(@Param('suggestionId') suggestionId: string) {
    return this.suggestions.detailAdmin(suggestionId);
  }

  @RequirePermission('SUGGESTIONS', 'MODERATE')
  @Idempotent()
  @HttpCode(200)
  @Post(':suggestionId/decision')
  decide(
    @CurrentUser() actor: IdentityContext,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: ModerationDecisionDto,
    @Req() req: ReqWithId,
  ) {
    return this.suggestions.decide(actor, suggestionId, dto, req.requestId ?? 'unknown');
  }
}
