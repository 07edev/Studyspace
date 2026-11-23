import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export enum NotificationType {
  POST_INTERACTION = 'POST_INTERACTION',
  POST_RESULT = 'POST_RESULT',
  DOCUMENT_RESULT = 'DOCUMENT_RESULT',
  REPORT_RESULT = 'REPORT_RESULT',
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
  SYSTEM = 'SYSTEM',
}

export enum NotificationTargetType {
  POST = 'POST',
  COMMENT = 'COMMENT',
  DOCUMENT = 'DOCUMENT',
  REPORT = 'REPORT',
}

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  recipientId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  body: string;

  @Prop({ type: String, enum: Object.values(NotificationTargetType) })
  targetType?: NotificationTargetType;

  @Prop({ type: 'ObjectId' })
  targetId?: Types.ObjectId;

  @Prop({ type: 'ObjectId', required: true, unique: true })
  sourceEventId: Types.ObjectId;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
