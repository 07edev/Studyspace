import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

// ERD fields + requestHash/state/statusCode/response (needed to replay safely).
@Schema({ collection: 'idempotency_keys', timestamps: { createdAt: true, updatedAt: false } })
export class IdempotencyKey {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  actorId: Types.ObjectId;

  @Prop({ required: true })
  route: string;

  @Prop({ required: true })
  key: string;

  // Same key with a different body is a client bug, not a retry.
  @Prop({ required: true })
  requestHash: string;

  @Prop({ required: true, enum: ['IN_PROGRESS', 'DONE'], default: 'IN_PROGRESS' })
  state: string;

  @Prop()
  responseHash?: string;

  @Prop()
  statusCode?: number;

  @Prop({ type: Object })
  response?: unknown;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}
export type IdempotencyKeyDocument = HydratedDocument<IdempotencyKey>;
export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey);
IdempotencyKeySchema.index({ actorId: 1, route: 1, key: 1 }, { unique: true });
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
