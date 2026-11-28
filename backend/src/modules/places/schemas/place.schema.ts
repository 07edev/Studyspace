import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import {
  DayOfWeek,
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../place.enums';

export type GeoJsonPoint = {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
};

export type PlaceAddressDoc = {
  line1: string;
  wardCode?: string;
  districtCode?: string;
  provinceCode: string;
  countryCode: 'VN';
  displayText?: string;
};

export type OpeningIntervalDoc = {
  open: string;
  close: string;
  overnight?: boolean;
};

export type OpeningDayDoc = {
  day: DayOfWeek;
  closed: boolean;
  intervals: OpeningIntervalDoc[];
};

export type PriceRangeDoc = {
  minVnd: number;
  maxVnd: number;
  note?: string;
  currency: 'VND';
};

export type ImageRefDoc = {
  fileId: string;
  url?: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
};

export type PlaceSourceDoc = {
  provider: PlaceOrigin;
  providerPlaceId: string;
  sourceUrl?: string;
  fetchedAt?: Date;
  licenseNote?: string;
  storedFields?: string[];
};

export type FieldStateDoc = {
  path: string;
  verified: FieldVerifiedStatus;
  locked: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  note?: string;
};

export type AttributeValueDoc = {
  definitionId: string;
  value: string | number | boolean | string[];
};

@Schema({ collection: 'places', timestamps: true })
export class PlaceEntity {
  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true })
  nameNormalized: string;

  @Prop({ type: String, required: true, enum: Object.values(PlaceCategory) })
  category: PlaceCategory;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  address: PlaceAddressDoc;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: GeoJsonPoint;

  @Prop({ type: String, required: false })
  phone?: string;

  @Prop({ type: String, required: false })
  website?: string;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  images: ImageRefDoc[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  hours: OpeningDayDoc[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  price?: PriceRangeDoc;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: String, enum: Object.values(QuietLevel), default: QuietLevel.UNKNOWN })
  quietLevel: QuietLevel;

  @Prop({ type: String, enum: Object.values(StudySuitability), default: StudySuitability.UNKNOWN })
  studySuitability: StudySuitability;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  attributes: AttributeValueDoc[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  fieldStates: FieldStateDoc[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  sources: PlaceSourceDoc[];

  @Prop({ type: String, required: true, enum: Object.values(PlaceOrigin), default: PlaceOrigin.MANUAL })
  origin: PlaceOrigin;

  @Prop({ type: String, required: true, enum: Object.values(PlaceStatus), default: PlaceStatus.DRAFT })
  status: PlaceStatus;

  @Prop({ type: Number, default: 0 })
  ratingAverage: number;

  @Prop({ type: Number, default: 0 })
  ratingCount: number;

  @Prop({ type: Number, default: 0 })
  reviewCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  createdBy?: Types.ObjectId;

  @Prop({ type: Number, default: 1 })
  version: number;

  @Prop({ type: Date, required: false })
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const PlaceSchema = SchemaFactory.createForClass(PlaceEntity);

PlaceSchema.index({ location: '2dsphere' });
PlaceSchema.index({ nameNormalized: 1, 'address.provinceCode': 1 });
PlaceSchema.index({ status: 1, category: 1, ratingAverage: -1 });
PlaceSchema.index({ status: 1, 'address.provinceCode': 1 });
PlaceSchema.index({ status: 1, updatedAt: -1 });
