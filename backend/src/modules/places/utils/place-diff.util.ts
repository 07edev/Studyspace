import type { FieldStateDoc, PlaceEntity } from '../schemas/place.schema';
import type { PlaceHistoryDiffItem } from '../schemas/place-history.schema';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const TRACKED_PLACE_FIELDS: (keyof PlaceEntity)[] = [
  'name',
  'category',
  'description',
  'address',
  'location',
  'phone',
  'website',
  'images',
  'hours',
  'price',
  'amenities',
  'quietLevel',
  'studySuitability',
  'attributes',
  'status',
];

export function computePlaceDiff(
  before: Partial<Record<string, unknown>>,
  after: Partial<Record<string, unknown>>,
  fields: string[] = TRACKED_PLACE_FIELDS as string[],
  source?: string,
): PlaceHistoryDiffItem[] {
  const diff: PlaceHistoryDiffItem[] = [];
  for (const field of fields) {
    if (!same(before[field], after[field])) {
      diff.push({
        field,
        before: before[field],
        after: after[field],
        ...(source ? { source } : {}),
      });
    }
  }
  return diff;
}

/**
 * Checks whether any modified top-level or nested path is locked in fieldStates.
 * Returns the first locked path that blocks the update, or undefined if allowed.
 */
export function findLockedFieldConflict(
  fieldStates: FieldStateDoc[] | undefined,
  touchedPaths: string[],
): string | undefined {
  if (!fieldStates || fieldStates.length === 0 || touchedPaths.length === 0) {
    return undefined;
  }
  const lockedPaths = fieldStates.filter(fs => fs.locked).map(fs => fs.path);
  for (const touched of touchedPaths) {
    for (const locked of lockedPaths) {
      if (
        touched === locked ||
        touched.startsWith(`${locked}.`) ||
        locked.startsWith(`${touched}.`)
      ) {
        return locked;
      }
    }
  }
  return undefined;
}
