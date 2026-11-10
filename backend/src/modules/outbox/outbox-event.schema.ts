import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

@Schema({ collection: 'outbox_events', timestamps: { createdAt: true, updatedAt: false } })
export class OutboxEvent {
  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  aggregateType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  aggregateId: Types.ObjectId;

  // Already redacted. Never put secrets or private object bodies here.
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'],
    default: 'PENDING',
  })
  status: OutboxStatus;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ required: true })
  nextAttemptAt: Date;

  createdAt: Date;
}
export type OutboxEventDocument = HydratedDocument<OutboxEvent>;
export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);
OutboxEventSchema.index({ status: 1, nextAttemptAt: 1 });
