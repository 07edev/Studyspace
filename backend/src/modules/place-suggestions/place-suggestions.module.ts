import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlacesModule } from '../places/places.module';
import { AdminSuggestionsController } from './admin-suggestions.controller';
import {
  PlaceSuggestionEntity,
  PlaceSuggestionSchema,
} from './place-suggestion.schema';
import { PlaceSuggestionsController } from './place-suggestions.controller';
import { PlaceSuggestionsService } from './place-suggestions.service';

@Module({
  imports: [
    PlacesModule,
    MongooseModule.forFeature([
      { name: PlaceSuggestionEntity.name, schema: PlaceSuggestionSchema },
    ]),
  ],
  controllers: [PlaceSuggestionsController, AdminSuggestionsController],
  providers: [PlaceSuggestionsService],
  exports: [PlaceSuggestionsService, MongooseModule],
})
export class PlaceSuggestionsModule {}
