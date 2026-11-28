import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlacesModule } from '../places/places.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { ReviewEntity, ReviewSchema } from './review.schema';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    PlacesModule,
    MongooseModule.forFeature([{ name: ReviewEntity.name, schema: ReviewSchema }]),
  ],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService, MongooseModule],
})
export class ReviewsModule {}
