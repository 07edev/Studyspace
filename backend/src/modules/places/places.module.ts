import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { AdminPlaceProvidersController } from './admin-place-providers.controller';
import { AdminPlacesController } from './admin-places.controller';
import { AdminPlacesService } from './admin-places.service';
import { PlaceAttributesController } from './place-attributes.controller';
import { PlaceAttributesService } from './place-attributes.service';
import { PlacesPublicController } from './places-public.controller';
import { PlacesPublicService } from './places-public.service';
import { PlacesStatsContributor } from './places-stats.contributor';
import { FavoriteLookupRegistry } from './ports/favorite-lookup.port';
import { NotConnectedPlaceFileRef, PlaceFileRef } from './ports/place-file.port';
import { CandidateTokenService } from './providers/candidate-token.service';
import { DuplicateCheckService } from './providers/duplicate-check.service';
import { PlaceProvidersService } from './providers/place-providers.service';
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
  controllers: [
    PlaceAttributesController,
    PlacesPublicController,
    AdminPlaceProvidersController,
    AdminPlacesController,
  ],
  providers: [
    PlaceAttributesService,
    PlacesPublicService,
    CandidateTokenService,
    DuplicateCheckService,
    PlaceProvidersService,
    AdminPlacesService,
    PlacesStatsContributor,
    FavoriteLookupRegistry,
    { provide: PlaceFileRef, useClass: NotConnectedPlaceFileRef },
  ],
  exports: [
    PlaceAttributesService,
    PlacesPublicService,
    CandidateTokenService,
    DuplicateCheckService,
    PlaceProvidersService,
    AdminPlacesService,
    PlacesStatsContributor,
    FavoriteLookupRegistry,
    PlaceFileRef,
    MongooseModule,
  ],
})
export class PlacesModule {}
