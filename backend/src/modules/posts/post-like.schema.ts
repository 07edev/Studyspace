import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema, Types } from 'mongoose';

@Schema({ collection: 'post_likes', timestamps: { createdAt: true, updatedAt: false } })
export class PostLike {
  @Prop({ type: Schema.Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Schema.Types.ObjectId, required: true, index: true })
  postId: Types.ObjectId;
}
export const PostLikeSchema = SchemaFactory.createForClass(PostLike);
PostLikeSchema.index({ userId: 1, postId: 1 }, { unique: true });
PostLikeSchema.index({ postId: 1, createdAt: -1 });
