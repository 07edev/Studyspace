import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export type PlaceHistoryDiffItem = {
  field: string;
  before?: unknown;
  after?: unknown;
  source?: string;
};

@Schema({ collection: 'place_history', timestamps: false })
export class PlaceHistoryEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  placeId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  actorId: Types.ObjectId;

  @Prop({ type: Date, required: true, default: () => new Date() })
  changedAt: Date;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  diff: PlaceHistoryDiffItem[];
}

export const PlaceHistorySchema = SchemaFactory.createForClass(PlaceHistoryEntity);

PlaceHistorySchema.index({ placeId: 1, changedAt: -1 });
PlaceHistorySchema.index({ actorId: 1, changedAt: -1 });
