import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { PlaceAttributesController } from './place-attributes.controller';
import { PlaceAttributesService } from './place-attributes.service';
import { PlacesPublicController } from './places-public.controller';
import { PlacesPublicService } from './places-public.service';
import { FavoriteLookupRegistry } from './ports/favorite-lookup.port';
import {
  PlaceAttributeDefinitionEntity,
  PlaceAttributeDefinitionSchema,
} from './schemas/place-attribute-definition.schema';
import { PlaceHistoryEntity, PlaceHistorySchema } from './schemas/place-history.schema';
import { PlaceEntity, PlaceSchema } from './schemas/place.schema';

@Module({
  imports: [
    TaxonomyModule,
    MongooseModule.forFeature([
      { name: PlaceEntity.name, schema: PlaceSchema },
      { name: PlaceAttributeDefinitionEntity.name, schema: PlaceAttributeDefinitionSchema },
      { name: PlaceHistoryEntity.name, schema: PlaceHistorySchema },
    ]),
  ],
  controllers: [PlaceAttributesController, PlacesPublicController],
  providers: [PlaceAttributesService, PlacesPublicService, FavoriteLookupRegistry],
  exports: [
    PlaceAttributesService,
    PlacesPublicService,
    FavoriteLookupRegistry,
    MongooseModule,
  ],
})
export class PlacesModule {}
