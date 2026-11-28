import { describe, expect, it } from 'vitest';
import {
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../src/modules/places/place.enums';
import type { PlaceEntity } from '../src/modules/places/schemas/place.schema';
import {
  buildPlaceUpdateFromChanges,
  validateSuggestionChanges,
} from '../src/modules/place-suggestions/utils/suggestion-rules';

describe('suggestion-rules', () => {
  it('enforces fieldPath allow-list and rejects locked fields with 409 FIELD_LOCKED', () => {
    expect(() =>
      validateSuggestionChanges([
        { fieldPath: 'status', newValue: 'DELETED', reason: 'Thử sửa trạng thái hệ thống' },
      ]),
    ).toThrow(/chưa hợp lệ/);

    expect(() =>
      validateSuggestionChanges(
        [{ fieldPath: 'name', newValue: 'Tên mới', reason: 'Đổi tên quán theo bảng hiệu mới' }],
        [{ path: 'name', verified: FieldVerifiedStatus.VERIFIED, locked: true }],
      ),
    ).toThrow(/đang bị khóa/);

    expect(() =>
      validateSuggestionChanges(
        [{ fieldPath: 'phone', newValue: '+84901234567', reason: 'Cập nhật số hotline mới của quán' }],
        [{ path: 'name', verified: FieldVerifiedStatus.VERIFIED, locked: true }],
      ),
    ).not.toThrow();
  });

  it('builds GeoJSON location, nameNormalized and PlaceHistory diff when applying changes', () => {
    const basePlace = {
      name: 'Quán Cũ',
      nameNormalized: 'quan cu',
      category: PlaceCategory.CAFE,
      address: { line1: '1 Lê Lợi', provinceCode: '79', countryCode: 'VN' as const },
      location: { type: 'Point' as const, coordinates: [106.7, 10.77] as [number, number] },
      images: [],
      hours: [],
      amenities: [],
      quietLevel: QuietLevel.QUIET,
      studySuitability: StudySuitability.BOTH,
      attributes: [],
      fieldStates: [],
      sources: [],
      origin: PlaceOrigin.MANUAL,
      status: PlaceStatus.PUBLISHED,
      ratingAverage: 0,
      ratingCount: 0,
      reviewCount: 0,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PlaceEntity;

    const { setPayload, diff } = buildPlaceUpdateFromChanges(basePlace, [
      { fieldPath: 'name', newValue: 'Quán Mới Yên Tĩnh', reason: 'Tên mới trên biển hiệu' },
      { fieldPath: 'location', newValue: { lat: 10.78, lng: 106.71 }, reason: 'Chỉnh lại tọa độ chính xác' },
    ]);

    expect(setPayload.name).toBe('Quán Mới Yên Tĩnh');
    expect(setPayload.nameNormalized).toBe('quan moi yen tinh');
    expect(setPayload.location).toEqual({ type: 'Point', coordinates: [106.71, 10.78] });
    expect(diff).toHaveLength(2);
    expect(diff[0]).toMatchObject({ field: 'name', before: 'Quán Cũ', after: 'Quán Mới Yên Tĩnh' });
  });
});
