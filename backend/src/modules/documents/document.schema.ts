import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum DocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export enum DocumentVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum DocumentFormat {
  PDF = 'PDF',
  DOCX = 'DOCX',
  PPTX = 'PPTX',
  XLSX = 'XLSX',
  TXT = 'TXT',
}

@Schema({ collection: 'documents', timestamps: true })
export class Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'FileAsset' })
  fileId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 200 })
  title: string;

  @Prop({ type: String, trim: true, maxlength: 3000 })
  description?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  subjectId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  majorId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80, index: true })
  category: string;

  @Prop({ type: String, required: true, maxlength: 255 })
  fileName: string;

  @Prop({ type: String, enum: Object.values(DocumentFormat), required: true })
  format: DocumentFormat;

  @Prop({ type: Number, required: true, min: 1, max: 20_000_000 })
  sizeBytes: number;

  @Prop({ type: String, enum: Object.values(DocumentVisibility), required: true, index: true })
  visibility: DocumentVisibility;

  @Prop({ type: Boolean, required: true })
  shareRightsConfirmed: boolean;

  @Prop({ type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.PENDING, index: true })
  status: DocumentStatus;

  @Prop({ type: Number, default: 0, min: 0 })
  viewsCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  downloadsCount: number;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: String, maxlength: 1000 })
  rejectionReason?: string;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);
DocumentSchema.index({ status: 1, visibility: 1, createdAt: -1 });
DocumentSchema.index({ authorId: 1, status: 1, createdAt: -1 });
DocumentSchema.index({ subjectId: 1, majorId: 1, category: 1, status: 1, createdAt: -1 });
