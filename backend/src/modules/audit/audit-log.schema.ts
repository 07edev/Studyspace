import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

@Schema({ collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  actorId?: Types.ObjectId;

  @Prop({ required: true, enum: ['SYSTEM', 'USER', 'ADMIN'] })
  actorType: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  resourceType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  resourceId?: Types.ObjectId;

  // Already redacted by AuditService before reaching the database.
  @Prop({ type: Object })
  before?: unknown;

  @Prop({ type: Object })
  after?: unknown;

  @Prop({ required: true })
  requestId: string;

  createdAt: Date;
}
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
AuditLogSchema.index({ requestId: 1 });

// Append-only: any attempt to mutate or delete through Mongoose is rejected.
AuditLogSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ],
  function () {
    throw new Error('audit_logs is append-only');
  },
);
