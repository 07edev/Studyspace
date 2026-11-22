import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum CommentStatus {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

@Schema({ collection: 'comments', timestamps: true })
export class Comment {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  content: string;

  @Prop({ type: String, enum: Object.values(CommentStatus), default: CommentStatus.VISIBLE, index: true })
  status: CommentStatus;

  createdAt: Date;
  updatedAt: Date;
}
export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ postId: 1, status: 1, createdAt: 1 });
CommentSchema.index({ authorId: 1, createdAt: -1 });
