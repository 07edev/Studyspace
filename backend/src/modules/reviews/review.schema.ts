import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import type { ImageRefDoc } from '../places/schemas/place.schema';

export enum ReviewStatus {
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

@Schema({ collection: 'reviews', timestamps: true })
export class ReviewEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  placeId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  authorId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, required: false })
  content?: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  images: ImageRefDoc[];

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ReviewStatus),
    default: ReviewStatus.PUBLISHED,
  })
  status: ReviewStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(ReviewEntity);

// Unique partial index: a user can only have one active (non-deleted) review per place.
ReviewSchema.index(
  { placeId: 1, authorId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN] },
    },
  },
);
ReviewSchema.index({ placeId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ placeId: 1, status: 1, rating: -1 });
ReviewSchema.index({ authorId: 1, createdAt: -1 });
