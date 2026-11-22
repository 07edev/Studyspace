import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ collection: 'post_saves', timestamps: { createdAt: true, updatedAt: false } })
export class PostSave {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  postId: Types.ObjectId;
}
export const PostSaveSchema = SchemaFactory.createForClass(PostSave);
PostSaveSchema.index({ userId: 1, postId: 1 }, { unique: true });
PostSaveSchema.index({ userId: 1, createdAt: -1 });
