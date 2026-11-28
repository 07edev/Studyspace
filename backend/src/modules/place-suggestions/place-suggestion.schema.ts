import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum SuggestionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type SuggestionChangeDoc = {
  fieldPath: string;
  oldValue?: unknown;
  newValue: unknown;
  reason: string;
};

@Schema({ collection: 'place_suggestions', timestamps: true })
export class PlaceSuggestionEntity {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  submittedBy: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(SuggestionType) })
  type: SuggestionType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  placeId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  proposedPlace?: Record<string, unknown>;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  changes: SuggestionChangeDoc[];

  @Prop({ type: [String], default: [] })
  evidenceFileIds: string[];

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SuggestionStatus),
    default: SuggestionStatus.PENDING,
  })
  status: SuggestionStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  reviewedAt?: Date;

  @Prop({ type: String, required: false })
  rejectionReason?: string;

  @Prop({ type: Number, default: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export const PlaceSuggestionSchema = SchemaFactory.createForClass(PlaceSuggestionEntity);

PlaceSuggestionSchema.index({ submittedBy: 1, status: 1, createdAt: -1 });
PlaceSuggestionSchema.index({ placeId: 1, status: 1 });
PlaceSuggestionSchema.index({ status: 1, createdAt: -1 });
