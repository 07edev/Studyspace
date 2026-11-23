import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

@Schema({ collection: 'posts', timestamps: true })
export class Post {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true, ref: 'User' })
  authorId: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 180 })
  title?: string;

  @Prop({ type: String, trim: true, maxlength: 10000 })
  content?: string;

  @Prop({ type: String, trim: true, minlength: 2, maxlength: 80, index: true })
  category?: string;

  @Prop({ type: String, enum: Object.values(PostStatus), required: true, index: true })
  status: PostStatus;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  subjectIds: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  imageFileIds: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  documentIds: Types.ObjectId[];

  @Prop({ type: Number, default: 0, min: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  commentsCount: number;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  createdAt: Date;
  updatedAt: Date;
}
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ category: 1, status: 1, createdAt: -1 });
PostSchema.index({ subjectIds: 1, status: 1, createdAt: -1 });
