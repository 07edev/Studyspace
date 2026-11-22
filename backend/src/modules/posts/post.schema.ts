import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema, Types } from 'mongoose';

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
}

@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({ type: Schema.Types.ObjectId, required: true, index: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  title: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 20000 })
  content: string;

  @Prop({ type: String, trim: true, maxlength: 80, index: true })
  category?: string;

  @Prop({ type: String, enum: Object.values(PostStatus), default: PostStatus.PUBLISHED, index: true })
  status: PostStatus;

  @Prop({ type: [Schema.Types.ObjectId], default: [] })
  imageFileIds: Types.ObjectId[];

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  commentsCount: number;

  createdAt: Date;
  updatedAt: Date;
}
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ category: 1, status: 1, createdAt: -1 });
