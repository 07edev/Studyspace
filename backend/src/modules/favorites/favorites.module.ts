import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlacesModule } from '../places/places.module';
import { FavoriteEntity, FavoriteSchema } from './favorite.schema';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [
    PlacesModule,
    MongooseModule.forFeature([{ name: FavoriteEntity.name, schema: FavoriteSchema }]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
