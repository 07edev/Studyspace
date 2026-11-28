import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AdminPlacesController } from './admin-places.controller';
import { AdminPlacesService } from './admin-places.service';
import { PlaceAttributesController } from './place-attributes.controller';
import { PlaceAttributesService } from './place-attributes.service';
import { PlacesPublicController } from './places-public.controller';
import { PlacesPublicService } from './places-public.service';
import { PlacesStatsContributor } from './places-stats.contributor';
import { FavoriteLookupRegistry } from './ports/favorite-lookup.port';
import { NotConnectedPlaceFileRef, PlaceFileRef } from './ports/place-file.port';
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
  controllers: [PlaceAttributesController, PlacesPublicController, AdminPlacesController],
  providers: [
    PlaceAttributesService,
    PlacesPublicService,
    AdminPlacesService,
    PlacesStatsContributor,
    FavoriteLookupRegistry,
    { provide: PlaceFileRef, useClass: NotConnectedPlaceFileRef },
  ],
  exports: [
    PlaceAttributesService,
    PlacesPublicService,
    AdminPlacesService,
    PlacesStatsContributor,
    FavoriteLookupRegistry,
    PlaceFileRef,
    MongooseModule,
  ],
})
export class PlacesModule {}
