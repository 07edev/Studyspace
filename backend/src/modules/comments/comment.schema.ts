import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum CommentStatus {
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

@Schema({ collection: 'comments', timestamps: true })
export class Comment {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  parentId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  content: string;

  @Prop({ type: String, enum: Object.values(CommentStatus), default: CommentStatus.PUBLISHED, index: true })
  status: CommentStatus;

  @Prop({ type: Number, default: 0, min: 0 })
  replyCount: number;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}
export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ postId: 1, parentId: 1, status: 1, createdAt: 1 });
CommentSchema.index({ authorId: 1, createdAt: -1 });
