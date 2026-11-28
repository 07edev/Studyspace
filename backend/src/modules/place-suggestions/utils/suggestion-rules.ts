import { ApiException, type FieldErrorDto } from '../../../common/api-error';
import { normalizeSearchText } from '../../../common/utils/text-normalize';
import type { PlaceHistoryDiffItem } from '../../places/schemas/place-history.schema';
import type { FieldStateDoc, OpeningDayDoc, PlaceEntity } from '../../places/schemas/place.schema';
import { validateOpeningHours } from '../../places/utils/opening-hours.util';
import { findLockedFieldConflict } from '../../places/utils/place-diff.util';
import type { SuggestionChangeDoc } from '../place-suggestion.schema';

// Strict allow-list of fields users are allowed to suggest updates for.
export const SUGGESTABLE_FIELD_PATHS = new Set<string>([
  'name',
  'category',
  'description',
  'address',
  'location',
  'phone',
  'website',
  'hours',
  'price',
  'amenities',
  'quietLevel',
  'studySuitability',
  'attributes',
]);

export function validateSuggestionChanges(
  changes: { fieldPath: string; newValue: unknown; reason: string }[],
  fieldStates?: FieldStateDoc[],
): void {
  const errors: FieldErrorDto[] = [];
  const seen = new Set<string>();

  changes.forEach((change, idx) => {
    if (!SUGGESTABLE_FIELD_PATHS.has(change.fieldPath)) {
      errors.push({
        field: `changes.${idx}.fieldPath`,
        rule: 'allowList',
        message: `Trường "${change.fieldPath}" không được phép đề xuất chỉnh sửa.`,
      });
    }
    if (seen.has(change.fieldPath)) {
      errors.push({
        field: `changes.${idx}.fieldPath`,
        rule: 'unique',
        message: `Trường "${change.fieldPath}" bị trùng lặp trong đề xuất.`,
      });
    }
    seen.add(change.fieldPath);
  });

  if (errors.length > 0) {
    throw new ApiException(422, 'VALIDATION_ERROR', 'Nội dung đề xuất chỉnh sửa chưa hợp lệ.', errors);
  }

  const locked = findLockedFieldConflict(
    fieldStates,
    changes.map(c => c.fieldPath),
  );
  if (locked) {
    throw new ApiException(
      409,
      'FIELD_LOCKED',
      `Trường "${locked}" đang bị khóa bởi quản trị viên, không thể đề xuất chỉnh sửa.`,
    );
  }
}

export function readPlaceFieldValue(place: PlaceEntity, fieldPath: string): unknown {
  if (fieldPath === 'location') {
    return {
      lat: place.location.coordinates[1],
      lng: place.location.coordinates[0],
    };
  }
  return (place as unknown as Record<string, unknown>)[fieldPath];
}

export function buildPlaceUpdateFromChanges(
  current: PlaceEntity,
  changes: SuggestionChangeDoc[],
): { setPayload: Record<string, unknown>; diff: PlaceHistoryDiffItem[] } {
  const setPayload: Record<string, unknown> = {};
  const diff: PlaceHistoryDiffItem[] = [];

  for (const change of changes) {
    const before = readPlaceFieldValue(current, change.fieldPath);
    if (change.fieldPath === 'name') {
      if (typeof change.newValue !== 'string' || change.newValue.trim().length < 2) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Tên địa điểm đề xuất không hợp lệ.');
      }
      const name = change.newValue.trim();
      setPayload.name = name;
      setPayload.nameNormalized = normalizeSearchText(name);
      diff.push({ field: 'name', before, after: name, source: 'USER_SUGGESTION' });
      continue;
    }

    if (change.fieldPath === 'location') {
      const loc = change.newValue as { lat?: number; lng?: number } | undefined;
      if (
        !loc ||
        typeof loc.lat !== 'number' ||
        typeof loc.lng !== 'number' ||
        loc.lat < -90 ||
        loc.lat > 90 ||
        loc.lng < -180 ||
        loc.lng > 180
      ) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Tọa độ đề xuất không hợp lệ.');
      }
      setPayload.location = { type: 'Point', coordinates: [loc.lng, loc.lat] };
      diff.push({ field: 'location', before, after: { lat: loc.lat, lng: loc.lng }, source: 'USER_SUGGESTION' });
      continue;
    }

    if (change.fieldPath === 'hours') {
      const normalized = validateOpeningHours(change.newValue as OpeningDayDoc[]);
      setPayload.hours = normalized;
      diff.push({ field: 'hours', before, after: normalized, source: 'USER_SUGGESTION' });
      continue;
    }

    if (change.fieldPath === 'price' && change.newValue && typeof change.newValue === 'object') {
      const price = change.newValue as { minVnd?: number; maxVnd?: number };
      if (
        typeof price.minVnd !== 'number' ||
        typeof price.maxVnd !== 'number' ||
        price.minVnd > price.maxVnd
      ) {
        throw new ApiException(422, 'VALIDATION_ERROR', 'Khoảng giá đề xuất không hợp lệ.');
      }
    }

    setPayload[change.fieldPath] = change.newValue;
    diff.push({ field: change.fieldPath, before, after: change.newValue, source: 'USER_SUGGESTION' });
  }

  return { setPayload, diff };
}
