import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { AccountStatus, Role } from '../../../common/enums';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  emailNormalized: string;

  // Optional: partial unique index below so many users may have no phone.
  @Prop({ type: String })
  phoneNormalized?: string;

  // Internal only. Never returned by APIs, never logged.
  @Prop({ type: String, select: false })
  passwordHash?: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.USER })
  role: Role;

  @Prop({
    type: String,
    enum: Object.values(AccountStatus),
    default: AccountStatus.PENDING_VERIFICATION,
  })
  status: AccountStatus;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: [String], default: [] })
  authProviders: string[];

  @Prop({ type: Object, default: {} })
  profile: Record<string, unknown>;

  @Prop({
    type: Object,
    default: { visibility: 'PUBLIC', showUniversity: true, showMajor: true },
  })
  privacy: Record<string, unknown>;

  @Prop({
    type: Object,
    default: {
      postInteraction: true,
      moderation: true,
      adminMessage: true,
      system: true,
      pushEnabled: false,
    },
  })
  notificationSettings: Record<string, unknown>;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNormalized: { $type: 'string' } },
  },
);
UserSchema.index({ status: 1, createdAt: -1 });
