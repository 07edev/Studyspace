import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export enum TaxonomyKind {
  PLACE_CATEGORY = 'PLACE_CATEGORY',
  AMENITY = 'AMENITY',
  UNIVERSITY = 'UNIVERSITY',
  MAJOR = 'MAJOR',
  SUBJECT = 'SUBJECT',
  PROVINCE = 'PROVINCE',
  WARD = 'WARD',
}

@Schema({ collection: 'taxonomy_items', timestamps: true })
export class TaxonomyItemEntity {
  @Prop({ type: String, required: true, enum: Object.values(TaxonomyKind) })
  kind: TaxonomyKind;

  @Prop({ type: String, required: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true })
  nameNormalized: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  parentId?: Types.ObjectId;

  @Prop({ type: String, required: false, trim: true })
  parentCode?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export type TaxonomyItemDocument = HydratedDocument<TaxonomyItemEntity>;
export const TaxonomyItemSchema = SchemaFactory.createForClass(TaxonomyItemEntity);

TaxonomyItemSchema.index({ kind: 1, code: 1 }, { unique: true });
TaxonomyItemSchema.index({ kind: 1, parentId: 1, active: 1, sortOrder: 1 });
TaxonomyItemSchema.index({ kind: 1, parentCode: 1, active: 1, sortOrder: 1 });
TaxonomyItemSchema.index({ kind: 1, nameNormalized: 1 });
