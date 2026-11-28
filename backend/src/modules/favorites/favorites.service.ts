import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { PlaceStatus } from '../places/place.enums';
import { toPublicPlaceDto } from '../places/place.mapper';
import { FavoriteLookupRegistry } from '../places/ports/favorite-lookup.port';
import { PlaceEntity } from '../places/schemas/place.schema';
import { FavoriteEntity } from './favorite.schema';

const placeNotFound = () => new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');

@Injectable()
export class FavoritesService implements OnModuleInit {
  constructor(
    @InjectModel(FavoriteEntity.name) private readonly favorites: Model<FavoriteEntity>,
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    private readonly lookupRegistry: FavoriteLookupRegistry,
  ) {}

  onModuleInit() {
    this.lookupRegistry.register((userId, placeIds) => this.findFavoritedIds(userId, placeIds));
  }

  async findFavoritedIds(userId: string, placeIds: string[]): Promise<Set<string>> {
    if (!isValidObjectId(userId) || placeIds.length === 0) {
      return new Set();
    }
    const validIds = placeIds.filter(isValidObjectId).map(id => new Types.ObjectId(id));
    if (validIds.length === 0) return new Set();
    const rows = await this.favorites
      .find({ userId: new Types.ObjectId(userId), placeId: { $in: validIds } })
      .select('placeId')
      .lean();
    return new Set(rows.map(r => String(r.placeId)));
  }

  async listMine(userId: string, query: PageQuery) {
    const { page, limit, skip } = pageParams(query);
    const owner = new Types.ObjectId(userId);
    const allFavs = await this.favorites
      .find({ userId: owner })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    if (allFavs.length === 0) {
      return toPage([], 0, page, limit);
    }
    const orderedPlaceIds = allFavs.map(f => f.placeId);
    const publishedDocs = await this.places
      .find({ _id: { $in: orderedPlaceIds }, status: PlaceStatus.PUBLISHED })
      .lean();
    const byId = new Map(publishedDocs.map(doc => [String(doc._id), doc]));
    const orderedPublished = orderedPlaceIds
      .map(id => byId.get(String(id)))
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

    const total = orderedPublished.length;
    const items = orderedPublished
      .slice(skip, skip + limit)
      .map(doc => toPublicPlaceDto(doc, { isFavorite: true }));
    return toPage(items, total, page, limit);
  }

  async add(userId: string, placeId: string) {
    if (!isValidObjectId(placeId)) throw placeNotFound();
    const exists = await this.places.exists({ _id: placeId, status: PlaceStatus.PUBLISHED });
    if (!exists) throw placeNotFound();

    await this.favorites.updateOne(
      { userId: new Types.ObjectId(userId), placeId: new Types.ObjectId(placeId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), placeId: new Types.ObjectId(placeId) } },
      { upsert: true },
    );
    return { value: true };
  }

  async remove(userId: string, placeId: string): Promise<void> {
    if (!isValidObjectId(placeId)) throw placeNotFound();
    const exists = await this.places.exists({ _id: placeId });
    if (!exists) throw placeNotFound();

    await this.favorites.deleteOne({
      userId: new Types.ObjectId(userId),
      placeId: new Types.ObjectId(placeId),
    });
  }
}
