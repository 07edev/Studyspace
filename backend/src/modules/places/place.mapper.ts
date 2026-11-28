import type { PlaceAttributeDefinitionEntity } from './schemas/place-attribute-definition.schema';
import type { PlaceHistoryEntity } from './schemas/place-history.schema';
import type { PlaceEntity } from './schemas/place.schema';
import { isOpenNowVn } from './utils/opening-hours.util';

export type PlaceWithId = PlaceEntity & { _id: unknown };

const toGeoPoint = (loc: PlaceEntity['location']) => ({
  lat: loc.coordinates[1],
  lng: loc.coordinates[0],
});

/** Redacted public view: NEVER exposes sources, fieldStates, createdBy, deletedAt or _id. */
export function toPublicPlaceDto(
  doc: PlaceWithId,
  opts: { isFavorite?: boolean; distanceMeters?: number; now?: Date } = {},
) {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    ...(doc.description !== undefined ? { description: doc.description } : {}),
    address: doc.address,
    location: toGeoPoint(doc.location),
    ...(doc.phone !== undefined ? { phone: doc.phone } : {}),
    ...(doc.website !== undefined ? { website: doc.website } : {}),
    images: doc.images ?? [],
    hours: doc.hours ?? [],
    ...(doc.price !== undefined ? { price: doc.price } : {}),
    amenities: doc.amenities ?? [],
    quietLevel: doc.quietLevel,
    studySuitability: doc.studySuitability,
    attributes: doc.attributes ?? [],
    origin: doc.origin,
    status: doc.status,
    ratingAverage: doc.ratingAverage ?? 0,
    ratingCount: doc.ratingCount ?? 0,
    reviewCount: doc.reviewCount ?? doc.ratingCount ?? 0,
    ...(opts.isFavorite !== undefined ? { isFavorite: opts.isFavorite } : {}),
    ...(opts.distanceMeters !== undefined ? { distanceMeters: opts.distanceMeters } : {}),
    openNow: isOpenNowVn(doc.hours, opts.now),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    version: doc.version ?? 1,
  };
}

/** Full admin view including provenance sources, fieldStates, createdBy and deletedAt. */
export function toAdminPlaceDto(doc: PlaceWithId) {
  return {
    ...toPublicPlaceDto(doc),
    fieldStates: (doc.fieldStates ?? []).map(fs => ({
      ...fs,
      ...(fs.verifiedAt instanceof Date ? { verifiedAt: fs.verifiedAt.toISOString() } : {}),
    })),
    sources: (doc.sources ?? []).map(src => ({
      ...src,
      ...(src.fetchedAt instanceof Date ? { fetchedAt: src.fetchedAt.toISOString() } : {}),
    })),
    ...(doc.createdBy ? { createdBy: String(doc.createdBy) } : {}),
    ...(doc.deletedAt
      ? { deletedAt: doc.deletedAt instanceof Date ? doc.deletedAt.toISOString() : doc.deletedAt }
      : {}),
  };
}

export function toPlaceMapFeatureDto(doc: PlaceWithId) {
  const cover = (doc.images ?? []).find(i => i.isCover) ?? (doc.images ?? [])[0];
  return {
    placeId: String(doc._id),
    name: doc.name,
    location: toGeoPoint(doc.location),
    category: doc.category,
    ratingAverage: doc.ratingAverage ?? 0,
    ...(cover?.url ? { coverUrl: cover.url } : {}),
  };
}

export function toAttributeDefinitionDto(doc: PlaceAttributeDefinitionEntity & { _id: unknown }) {
  return {
    id: String(doc._id),
    key: doc.key,
    label: doc.label,
    type: doc.type,
    ...(doc.options ? { options: doc.options } : {}),
    ...(doc.unit ? { unit: doc.unit } : {}),
    required: doc.required,
    filterable: doc.filterable,
    active: doc.active,
    ...(doc.category ? { category: doc.category } : {}),
    ...(doc.createdAt
      ? { createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt }
      : {}),
  };
}

export function toPlaceHistoryDto(doc: PlaceHistoryEntity & { _id: unknown }) {
  return {
    id: String(doc._id),
    placeId: String(doc.placeId),
    actorId: String(doc.actorId),
    changedAt: doc.changedAt instanceof Date ? doc.changedAt.toISOString() : doc.changedAt,
    diff: doc.diff ?? [],
  };
}
