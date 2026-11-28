import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { AdminReviewsQueryDto, ReviewModerateDto } from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';

type ReqWithId = Request & { requestId?: string };

@ApiTags('AdminReviews')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @RequirePermission('REVIEWS', 'READ')
  @Get()
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviews.listAdmin(query);
  }

  @RequirePermission('REVIEWS', 'READ')
  @Get(':reviewId')
  detail(@Param('reviewId') reviewId: string) {
    return this.reviews.detailAdmin(reviewId);
  }

  @RequirePermission('REVIEWS', 'MODERATE')
  @Patch(':reviewId/moderation')
  moderate(
    @CurrentUser() actor: IdentityContext,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewModerateDto,
    @Req() req: ReqWithId,
  ) {
    return this.reviews.moderate(actor, reviewId, dto, req.requestId ?? 'unknown');
  }
}
