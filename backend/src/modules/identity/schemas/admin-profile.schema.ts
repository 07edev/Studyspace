import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';
import { AdminStatus, type Permission } from '../../../common/enums';

// Single source of truth for admin status + permissions. users.role says WHO is admin.
@Schema({ collection: 'admin_profiles', timestamps: true })
export class AdminProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AdminStatus),
    default: AdminStatus.ACTIVE,
  })
  status: AdminStatus;

  @Prop({ type: [Object], default: [] })
  permissions: Permission[];

  createdAt: Date;
  updatedAt: Date;
}
export type AdminProfileDocument = HydratedDocument<AdminProfile>;
export const AdminProfileSchema = SchemaFactory.createForClass(AdminProfile);
AdminProfileSchema.index({ status: 1 });
