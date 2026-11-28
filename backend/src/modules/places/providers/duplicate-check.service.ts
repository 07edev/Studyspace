import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type QueryFilter, Types } from 'mongoose';
import { normalizeSearchText } from '../../../common/utils/text-normalize';
import type { DuplicateCheckDto } from '../dto/place-providers.dto';
import { PlaceStatus } from '../place.enums';
import { PlaceEntity } from '../schemas/place.schema';
import { haversineMeters } from '../utils/opening-hours.util';

export type DuplicateMatchDto = {
  placeId: string;
  name: string;
  addressText?: string;
  category: string;
  status: string;
  distanceMeters: number;
  similarityScore: number;
};

/** Token-level Jaccard + substring similarity score in [0, 1]. */
export function nameSimilarityScore(rawA: string, rawB: string): number {
  const a = normalizeSearchText(rawA);
  const b = normalizeSearchText(rawB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Number((intersection / union).toFixed(2));
}

@Injectable()
export class DuplicateCheckService {
  constructor(@InjectModel(PlaceEntity.name) private readonly places: Model<PlaceEntity>) {}

  async check(dto: DuplicateCheckDto): Promise<{
    possibleDuplicates: DuplicateMatchDto[];
    requiresReview: boolean;
  }> {
    const normalized = normalizeSearchText(dto.name);
    const deltaDeg = 0.005; // ~550m box around target coordinates
    const filter: QueryFilter<PlaceEntity> = {
      status: { $ne: PlaceStatus.DELETED },
      ...(dto.excludePlaceId && isValidObjectId(dto.excludePlaceId)
        ? { _id: { $ne: new Types.ObjectId(dto.excludePlaceId) } }
        : {}),
      $or: [
        {
          location: {
            $geoWithin: {
              $box: [
                [dto.location.lng - deltaDeg, dto.location.lat - deltaDeg],
                [dto.location.lng + deltaDeg, dto.location.lat + deltaDeg],
              ],
            },
          },
        },
        ...(normalized ? [{ nameNormalized: normalized }] : []),
      ],
    };

    const candidates = await this.places.find(filter).limit(50).lean();
    const matches: DuplicateMatchDto[] = [];
    for (const doc of candidates) {
      const distanceMeters = haversineMeters(
        dto.location.lat,
        dto.location.lng,
        doc.location.coordinates[1],
        doc.location.coordinates[0],
      );
      const similarityScore = nameSimilarityScore(dto.name, doc.name);
      const isClose = distanceMeters <= 250;
      const isVerySimilar = similarityScore >= 0.65 && distanceMeters <= 1000;
      const isSameSpot = distanceMeters <= 60;
      if (isSameSpot || (isClose && similarityScore >= 0.3) || isVerySimilar) {
        matches.push({
          placeId: String(doc._id),
          name: doc.name,
          addressText: doc.address?.displayText ?? doc.address?.line1,
          category: doc.category,
          status: doc.status,
          distanceMeters,
          similarityScore,
        });
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore || a.distanceMeters - b.distanceMeters);
    const possibleDuplicates = matches.slice(0, 10);
    const requiresReview = possibleDuplicates.some(
      m => (m.distanceMeters <= 120 && m.similarityScore >= 0.5) || m.distanceMeters <= 40,
    );
    return { possibleDuplicates, requiresReview };
  }
}
