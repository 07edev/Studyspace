import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { PageQuery } from '../../common/utils/page';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@Controller('users/me/favorites/places')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: IdentityContext, @Query() query: PageQuery) {
    return this.favorites.listMine(user.userId, query);
  }

  @Put(':placeId')
  add(@CurrentUser() user: IdentityContext, @Param('placeId') placeId: string) {
    return this.favorites.add(user.userId, placeId);
  }

  @Delete(':placeId')
  @HttpCode(204)
  async remove(@CurrentUser() user: IdentityContext, @Param('placeId') placeId: string) {
    await this.favorites.remove(user.userId, placeId);
  }
}
