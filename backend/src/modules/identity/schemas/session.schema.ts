import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, type HydratedDocument } from 'mongoose';

// Raw refresh tokens are never stored; only their sha256 hash.
@Schema({ collection: 'sessions', timestamps: { createdAt: true, updatedAt: false } })
export class Session {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  refreshTokenHash: string;

  // All rotations of one login share a family; reuse of an old token revokes the family.
  @Prop({ required: true, index: true })
  familyId: string;

  @Prop({ required: true, enum: ['WEB_ADMIN', 'MOBILE'] })
  client: string;

  @Prop()
  revokedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}
export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
// TTL only cleans up. Expiry must still be checked at request time.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
