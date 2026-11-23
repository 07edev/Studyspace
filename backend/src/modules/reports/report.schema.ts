import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

export enum ReportTargetType {
  POST = 'POST',
  COMMENT = 'COMMENT',
  DOCUMENT = 'DOCUMENT',
}

export enum ReportReasonCode {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  INAPPROPRIATE = 'INAPPROPRIATE',
  MISINFORMATION = 'MISINFORMATION',
  COPYRIGHT = 'COPYRIGHT',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

@Schema({ collection: 'reports', timestamps: true })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ReportTargetType), required: true, index: true })
  targetType: ReportTargetType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  targetId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  targetOwnerId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ReportReasonCode), required: true })
  reasonCode: ReportReasonCode;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  description?: string;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'FileAsset', default: [] })
  evidenceFileIds: Types.ObjectId[];

  @Prop({ type: String, enum: Object.values(ReportStatus), default: ReportStatus.PENDING, index: true })
  status: ReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  decidedBy?: Types.ObjectId;

  @Prop({ type: String, maxlength: 1000 })
  decisionReason?: string;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  @Prop({ type: String, unique: true, sparse: true, select: false })
  activeKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ reporterId: 1, createdAt: -1 });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
