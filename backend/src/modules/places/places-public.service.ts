import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter, Types } from 'mongoose';
import { ApiException } from '../../common/api-error';
import { escapeRegex, pageParams, toPage, type PageQuery } from '../../common/utils/page';
import { normalizeSearchText } from '../../common/utils/text-normalize';
import { TaxonomyKind } from '../taxonomy/schemas/taxonomy-item.schema';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type {
  HomeQueryDto,
  PlacesFacetsQueryDto,
  PlacesMapQueryDto,
  PlacesPublicQueryDto,
} from './dto/places-public.dto';
import { PlaceCategory, PlaceStatus } from './place.enums';
import {
  toAttributeDefinitionDto,
  toPlaceMapFeatureDto,
  toPublicPlaceDto,
  type PlaceWithId,
} from './place.mapper';
import { FavoriteLookupRegistry } from './ports/favorite-lookup.port';
import { PlaceAttributeDefinitionEntity } from './schemas/place-attribute-definition.schema';
import { PlaceEntity } from './schemas/place.schema';
import { haversineMeters, isOpenNowVn } from './utils/opening-hours.util';

const MAX_BBOX_SPAN_DEG = 2.0;

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  [PlaceCategory.CAFE]: 'Quán cà phê học tập',
  [PlaceCategory.LIBRARY]: 'Thư viện',
  [PlaceCategory.COWORKING]: 'Coworking Space',
  [PlaceCategory.STUDY_ROOM]: 'Phòng tự học',
  [PlaceCategory.OTHER]: 'Không gian khác',
};

export function parseBbox(raw: string): [number, number, number, number] {
  const parts = raw.split(',').map(s => Number(s.trim()));
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    throw new ApiException(400, 'QUERY_INVALID', 'Tham số bbox không hợp lệ.', [
      { field: 'bbox', rule: 'format', message: 'bbox phải có dạng minLng,minLat,maxLng,maxLat.' },
    ]);
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (
    minLng < -180 ||
    maxLng > 180 ||
    minLat < -90 ||
    maxLat > 90 ||
    minLng >= maxLng ||
    minLat >= maxLat
  ) {
    throw new ApiException(400, 'QUERY_INVALID', 'Tọa độ bbox không hợp lệ.');
  }
  if (maxLng - minLng > MAX_BBOX_SPAN_DEG || maxLat - minLat > MAX_BBOX_SPAN_DEG) {
    throw new ApiException(
      400,
      'MAP_BOUNDS_TOO_LARGE',
      'Vùng bản đồ quá rộng. Vui lòng phóng to để tải địa điểm.',
    );
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function parseAttributeFilters(raw?: string): Record<string, string | number | boolean> {
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not object');
      }
      const result: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          result[k] = v;
        }
      }
      return result;
    } catch {
      throw new ApiException(400, 'QUERY_INVALID', 'Bộ lọc thuộc tính (attributeFilters) không hợp lệ.');
    }
  }
  const result: Record<string, string | number | boolean> = {};
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) {
      throw new ApiException(400, 'QUERY_INVALID', 'Bộ lọc thuộc tính (attributeFilters) không hợp lệ.');
    }
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!key || !val) continue;
    if (val === 'true') result[key] = true;
    else if (val === 'false') result[key] = false;
    else result[key] = val;
  }
  return result;
}

@Injectable()
export class PlacesPublicService {
  constructor(
    @InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>,
    @InjectModel(PlaceAttributeDefinitionEntity.name)
    private readonly definitions: Model<PlaceAttributeDefinitionEntity>,
    private readonly taxonomy: TaxonomyService,
    private readonly favorites: FavoriteLookupRegistry,
  ) {}

  private async attachFavorites(
    docs: PlaceWithId[],
    userId?: string,
    coords?: { lat: number; lng: number },
  ) {
    const favSet = await this.favorites.lookup(
      userId,
      docs.map(d => String(d._id)),
    );
    const now = new Date();
    return docs.map(doc =>
      toPublicPlaceDto(doc, {
        ...(userId ? { isFavorite: favSet.has(String(doc._id)) } : {}),
        ...(coords
          ? {
              distanceMeters: haversineMeters(
                coords.lat,
                coords.lng,
                doc.location.coordinates[1],
                doc.location.coordinates[0],
              ),
            }
          : {}),
        now,
      }),
    );
  }

  async home(query: HomeQueryDto, userId?: string) {
    const hasCoords = query.lat !== undefined && query.lng !== undefined;
    if ((query.lat !== undefined) !== (query.lng !== undefined)) {
      throw new ApiException(422, 'INVALID_COORDINATES', 'Cần truyền đủ cả lat và lng.');
    }
    const coords = hasCoords ? { lat: query.lat!, lng: query.lng! } : undefined;
    const baseFilter: QueryFilter<PlaceEntity> = { status: PlaceStatus.PUBLISHED };

    const [categoriesPage, topRatedDocs, recentlyUpdatedDocs, nearbyDocs] = await Promise.all([
      this.taxonomy.listByKind(TaxonomyKind.PLACE_CATEGORY, { page: 1, limit: 20 }),
      this.places
        .find(baseFilter)
        .sort({ ratingAverage: -1, ratingCount: -1, _id: -1 })
        .limit(8)
        .lean(),
      this.places
        .find(baseFilter)
        .sort({ updatedAt: -1, _id: -1 })
        .limit(8)
        .lean(),
      hasCoords
        ? this.places
            .find({
              ...baseFilter,
              location: {
                $near: {
                  $geometry: { type: 'Point', coordinates: [query.lng!, query.lat!] },
                  $maxDistance: 15_000,
                },
              },
            })
            .limit(8)
            .lean()
        : this.places.find(baseFilter).sort({ ratingCount: -1, _id: -1 }).limit(8).lean(),
    ]);

    const [nearby, topRated, recentlyUpdated] = await Promise.all([
      this.attachFavorites(nearbyDocs, userId, coords),
      this.attachFavorites(topRatedDocs, userId, coords),
      this.attachFavorites(recentlyUpdatedDocs, userId, coords),
    ]);

    return {
      categories: categoriesPage.items,
      nearby,
      topRated,
      recentlyUpdated,
    };
  }

  async list(query: PlacesPublicQueryDto, userId?: string) {
    const { page, limit, skip } = pageParams(query);
    const hasLat = query.lat !== undefined;
    const hasLng = query.lng !== undefined;
    if (hasLat !== hasLng) {
      throw new ApiException(422, 'INVALID_COORDINATES', 'Cần truyền đủ cả lat và lng.');
    }
    if (query.sort === 'DISTANCE' && !hasLat) {
      throw new ApiException(
        422,
        'INVALID_COORDINATES',
        'Sắp xếp theo khoảng cách yêu cầu tọa độ lat và lng.',
      );
    }
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new ApiException(400, 'QUERY_INVALID', 'Giá tối thiểu không được lớn hơn giá tối đa.');
    }

    const filter: QueryFilter<PlaceEntity> = { status: PlaceStatus.PUBLISHED };
    if (query.category) filter.category = query.category;
    if (query.provinceCode) filter['address.provinceCode'] = query.provinceCode;
    if (query.quietLevel) filter.quietLevel = query.quietLevel;
    if (query.studySuitability) filter.studySuitability = query.studySuitability;
    if (query.amenities && query.amenities.length > 0) {
      filter.amenities = { $all: query.amenities };
    }
    if (query.minPrice !== undefined) {
      filter['price.maxVnd'] = { $gte: query.minPrice };
    }
    if (query.maxPrice !== undefined) {
      filter['price.minVnd'] = { $lte: query.maxPrice };
    }
    if (query.q) {
      const normalized = normalizeSearchText(query.q);
      const raw = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [
        { name: raw },
        ...(normalized ? [{ nameNormalized: new RegExp(escapeRegex(normalized), 'i') }] : []),
        { 'address.line1': raw },
        { 'address.displayText': raw },
      ];
    }

    const attrFilters = parseAttributeFilters(query.attributeFilters);
    const attrEntries = Object.entries(attrFilters);
    if (attrEntries.length > 0) {
      const andClauses: QueryFilter<PlaceEntity>[] = attrEntries.map(([definitionId, value]) => ({
        attributes: { $elemMatch: { definitionId, value } },
      }));
      const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
      filter.$and = [...existingAnd, ...andClauses];
    }

    const coords = hasLat ? { lat: query.lat!, lng: query.lng! } : undefined;
    if (coords && query.radiusMeters) {
      filter.location = {
        $geoWithin: {
          $centerSphere: [[coords.lng, coords.lat], query.radiusMeters / 6_378_100],
        },
      };
    }

    // When filtering openNow or sorting by DISTANCE, evaluate in-memory on bounded set for exact UTC+7 / distance.
    if (query.openNow || query.sort === 'DISTANCE') {
      const candidates: PlaceWithId[] = await this.places.find(filter).limit(500).lean();
      const now = new Date();
      let matched: PlaceWithId[] = query.openNow
        ? candidates.filter(p => isOpenNowVn(p.hours, now))
        : candidates;
      if (query.sort === 'DISTANCE' && coords) {
        matched = [...matched].sort((a, b) => {
          const da = haversineMeters(
            coords.lat,
            coords.lng,
            a.location.coordinates[1],
            a.location.coordinates[0],
          );
          const db = haversineMeters(
            coords.lat,
            coords.lng,
            b.location.coordinates[1],
            b.location.coordinates[0],
          );
          return da - db;
        });
      } else {
        matched = this.sortInMemory(matched, query.sort);
      }
      const total = matched.length;
      const slice = matched.slice(skip, skip + limit);
      const items = await this.attachFavorites(slice, userId, coords);
      return toPage(items, total, page, limit);
    }

    const sortSpec: Record<string, 1 | -1> =
      query.sort === 'RATING'
        ? { ratingAverage: -1, ratingCount: -1, _id: -1 }
        : query.sort === 'POPULAR'
          ? { ratingCount: -1, ratingAverage: -1, _id: -1 }
          : { updatedAt: -1, _id: -1 };

    const [docs, total] = await Promise.all([
      this.places.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
      this.places.countDocuments(filter),
    ]);
    const items = await this.attachFavorites(docs, userId, coords);
    return toPage(items, total, page, limit);
  }

  private sortInMemory(docs: PlaceWithId[], sort?: PlacesPublicQueryDto['sort']) {
    const copy = [...docs];
    if (sort === 'RATING') {
      return copy.sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0));
    }
    if (sort === 'POPULAR') {
      return copy.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
    }
    return copy.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async map(query: PlacesMapQueryDto) {
    const [minLng, minLat, maxLng, maxLat] = parseBbox(query.bbox);
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<PlaceEntity> = {
      status: PlaceStatus.PUBLISHED,
      location: {
        $geoWithin: {
          $box: [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
        },
      },
    };
    if (query.category) filter.category = query.category;
    if (query.amenities && query.amenities.length > 0) {
      filter.amenities = { $all: query.amenities };
    }
    const [docs, total] = await Promise.all([
      this.places
        .find(filter)
        .sort({ ratingAverage: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.places.countDocuments(filter),
    ]);
    return toPage(docs.map(toPlaceMapFeatureDto), total, page, limit);
  }

  async facets(query: PlacesFacetsQueryDto) {
    const baseMatch: Record<string, unknown> = { status: PlaceStatus.PUBLISHED };
    const filteredMatch: Record<string, unknown> = {
      ...baseMatch,
      ...(query.category ? { category: query.category } : {}),
    };
    const [catCounts, amenityCounts, defs, amenityTax] = await Promise.all([
      this.places.aggregate<{ _id: PlaceCategory; count: number }>([
        { $match: baseMatch },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      this.places.aggregate<{ _id: string; count: number }>([
        { $match: filteredMatch },
        { $unwind: '$amenities' },
        { $group: { _id: '$amenities', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      this.definitions
        .find({
          active: true,
          filterable: true,
          ...(query.category
            ? { $or: [{ category: query.category }, { category: { $exists: false } }, { category: null }] }
            : {}),
        })
        .lean(),
      this.taxonomy.listByKind(TaxonomyKind.AMENITY, { page: 1, limit: 100 }),
    ]);

    const amenityNameByCode = new Map(amenityTax.items.map(a => [a.code, a.name]));
    return {
      categories: catCounts.map(c => ({
        value: c._id,
        label: CATEGORY_LABELS[c._id] ?? c._id,
        count: c.count,
      })),
      amenities: amenityCounts.map(a => ({
        value: a._id,
        label: amenityNameByCode.get(a._id) ?? a._id,
        count: a.count,
      })),
      customAttributes: defs.map(toAttributeDefinitionDto),
    };
  }

  async detail(placeId: string, userId?: string) {
    if (!isValidObjectId(placeId)) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');
    }
    const doc = await this.places
      .findOne({ _id: placeId, status: PlaceStatus.PUBLISHED })
      .lean();
    if (!doc) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');
    }
    const [dto] = await this.attachFavorites([doc], userId);
    return dto;
  }

  async similar(placeId: string, query: PageQuery, userId?: string) {
    if (!isValidObjectId(placeId)) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');
    }
    const anchor = await this.places
      .findOne({ _id: placeId, status: PlaceStatus.PUBLISHED })
      .lean();
    if (!anchor) {
      throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy địa điểm.');
    }
    const { page, limit, skip } = pageParams(query);
    const filter: QueryFilter<PlaceEntity> = {
      _id: { $ne: new Types.ObjectId(placeId) },
      status: PlaceStatus.PUBLISHED,
      $or: [
        { category: anchor.category },
        { 'address.provinceCode': anchor.address.provinceCode },
      ],
    };
    const [docs, total] = await Promise.all([
      this.places
        .find(filter)
        .sort({ ratingAverage: -1, ratingCount: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.places.countDocuments(filter),
    ]);
    const items = await this.attachFavorites(docs, userId, {
      lat: anchor.location.coordinates[1],
      lng: anchor.location.coordinates[0],
    });
    return toPage(items, total, page, limit);
  }
}
