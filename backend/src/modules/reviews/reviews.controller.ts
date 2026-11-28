import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import { PlaceReviewsQueryDto, ReviewWriteDto } from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('places/:placeId/reviews')
  listByPlace(@Param('placeId') placeId: string, @Query() query: PlaceReviewsQueryDto) {
    return this.reviews.listByPlace(placeId, query);
  }

  @Post('places/:placeId/reviews')
  create(
    @CurrentUser() actor: IdentityContext,
    @Param('placeId') placeId: string,
    @Body() dto: ReviewWriteDto,
  ) {
    return this.reviews.create(actor, placeId, dto);
  }

  @Patch('reviews/:reviewId')
  patch(
    @CurrentUser() actor: IdentityContext,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReviewWriteDto,
  ) {
    return this.reviews.patch(actor, reviewId, dto);
  }

  @Delete('reviews/:reviewId')
  @HttpCode(204)
  async remove(@CurrentUser() actor: IdentityContext, @Param('reviewId') reviewId: string) {
    await this.reviews.remove(actor, reviewId);
  }

  @Get('users/me/reviews')
  listMine(@CurrentUser() actor: IdentityContext, @Query() query: PageQuery) {
    return this.reviews.listMine(actor.userId, query);
  }
}
