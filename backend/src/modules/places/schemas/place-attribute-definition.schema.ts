import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AttributeType, PlaceCategory } from '../place.enums';

@Schema({ collection: 'place_attribute_definitions', timestamps: true })
export class PlaceAttributeDefinitionEntity {
  @Prop({ type: String, required: true, trim: true })
  key: string;

  @Prop({ type: String, required: true, trim: true })
  label: string;

  @Prop({ type: String, required: true, enum: Object.values(AttributeType) })
  type: AttributeType;

  @Prop({ type: [String], required: false })
  options?: string[];

  @Prop({ type: String, required: false, trim: true })
  unit?: string;

  @Prop({ type: Boolean, default: false })
  required: boolean;

  @Prop({ type: Boolean, default: false })
  filterable: boolean;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: String, required: false, enum: Object.values(PlaceCategory) })
  category?: PlaceCategory;

  createdAt: Date;
  updatedAt: Date;
}

export const PlaceAttributeDefinitionSchema = SchemaFactory.createForClass(
  PlaceAttributeDefinitionEntity,
);

PlaceAttributeDefinitionSchema.index({ key: 1, category: 1 }, { unique: true });
PlaceAttributeDefinitionSchema.index({ active: 1, filterable: 1 });
