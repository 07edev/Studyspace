import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ collection: 'favorites', timestamps: { createdAt: true, updatedAt: false } })
export class FavoriteEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  placeId: Types.ObjectId;

  createdAt: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(FavoriteEntity);

FavoriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, createdAt: -1 });
