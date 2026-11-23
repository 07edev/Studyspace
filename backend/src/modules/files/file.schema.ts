import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum FilePurpose {
  AVATAR = 'AVATAR',
  PLACE_IMAGE = 'PLACE_IMAGE',
  REVIEW_IMAGE = 'REVIEW_IMAGE',
  POST_IMAGE = 'POST_IMAGE',
  DOCUMENT = 'DOCUMENT',
  EVIDENCE = 'EVIDENCE',
}

export enum FileStatus {
  INITIATED = 'INITIATED',
  UPLOADED = 'UPLOADED',
  SCANNING = 'SCANNING',
  READY = 'READY',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Schema({ collection: 'files', timestamps: true })
export class FileAsset {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'User' })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(FilePurpose), required: true, index: true })
  purpose: FilePurpose;

  @Prop({ type: String, required: true, maxlength: 255 })
  fileName: string;

  @Prop({ type: String, required: true, select: false })
  storageKey: string;

  @Prop({ type: String, required: true })
  contentType: string;

  @Prop({ type: Number, required: true, min: 1 })
  sizeBytes: number;

  @Prop({ type: String, match: /^[a-fA-F0-9]{64}$/ })
  checksumSha256?: string;

  @Prop({ type: String, enum: Object.values(FileStatus), default: FileStatus.INITIATED, index: true })
  status: FileStatus;

  @Prop({ type: Date, index: true })
  expiresAt?: Date;

  @Prop({ type: Date })
  scannedAt?: Date;

  @Prop({ type: String, maxlength: 500 })
  rejectionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const FileAssetSchema = SchemaFactory.createForClass(FileAsset);
FileAssetSchema.index({ ownerId: 1, purpose: 1, status: 1, createdAt: -1 });
FileAssetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
