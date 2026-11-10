import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

@Schema({ collection: 'user_devices', timestamps: { createdAt: true, updatedAt: false } })
export class UserDevice {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['ANDROID', 'IOS', 'WEB'] })
  platform: string;

  @Prop({ required: true })
  pushTokenHash: string;

  @Prop()
  lastSeenAt?: Date;

  createdAt: Date;
}
export type UserDeviceDocument = HydratedDocument<UserDevice>;
export const UserDeviceSchema = SchemaFactory.createForClass(UserDevice);
UserDeviceSchema.index({ userId: 1, pushTokenHash: 1 }, { unique: true });
