import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

@Schema({ collection: 'otp_challenges', timestamps: { createdAt: true, updatedAt: false } })
export class OtpChallenge {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  emailNormalized: string;

  // EMAIL_VERIFY | PASSWORD_RESET | CONTACT_CHANGE ... checked per flow.
  @Prop({ required: true })
  purpose: string;

  // sha256 of the code; the code itself is never stored or logged.
  @Prop({ required: true })
  otpHash: string;

  // Extra to ERD: new email/phone for CONTACT_CHANGE challenges.
  @Prop({ type: String })
  target?: string;

  @Prop({ default: 0 })
  attemptCount: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  consumedAt?: Date;

  createdAt: Date;
}
export type OtpChallengeDocument = HydratedDocument<OtpChallenge>;
export const OtpChallengeSchema = SchemaFactory.createForClass(OtpChallenge);
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpChallengeSchema.index({ emailNormalized: 1, purpose: 1, createdAt: -1 });
