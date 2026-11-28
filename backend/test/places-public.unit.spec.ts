import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  AttributeType,
  DayOfWeek,
  FieldVerifiedStatus,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  QuietLevel,
  StudySuitability,
} from '../src/modules/places/place.enums';
import { toAdminPlaceDto, toPublicPlaceDto } from '../src/modules/places/place.mapper';
import { parseAttributeFilters, parseBbox } from '../src/modules/places/places-public.service';
import { validateAttributeValues } from '../src/modules/places/utils/attribute-validator';
import {
  haversineMeters,
  isOpenNowVn,
  validateOpeningHours,
} from '../src/modules/places/utils/opening-hours.util';

describe('opening-hours.util', () => {
  it('accepts valid normal and overnight intervals and rejects overlaps', () => {
    const valid = validateOpeningHours([
      { day: DayOfWeek.MON, closed: false, intervals: [{ open: '07:00', close: '12:00' }, { open: '13:30', close: '22:00' }] },
      { day: DayOfWeek.FRI, closed: false, intervals: [{ open: '20:00', close: '02:00', overnight: true }] },
      { day: DayOfWeek.SUN, closed: true, intervals: [] },
    ]);
    expect(valid).toHaveLength(3);

    expect(() =>
      validateOpeningHours([
        { day: DayOfWeek.MON, closed: false, intervals: [{ open: '08:00', close: '14:00' }, { open: '13:00', close: '18:00' }] },
      ]),
    ).toThrow(/Giờ mở cửa/);

    expect(() =>
      validateOpeningHours([
        { day: DayOfWeek.MON, closed: false, intervals: [{ open: '22:00', close: '08:00' }] },
      ]),
    ).toThrow(/Giờ mở cửa/);
  });

  it('evaluates isOpenNowVn in UTC+7 including overnight spillover from previous day', () => {
    const hours = [
      { day: DayOfWeek.FRI, closed: false, intervals: [{ open: '20:00', close: '02:00', overnight: true }] },
      { day: DayOfWeek.SAT, closed: false, intervals: [{ open: '08:00', close: '22:00' }] },
    ];
    // 2026-11-28 is Saturday. 01:00 VN = 2026-11-27T18:00:00Z
    expect(isOpenNowVn(hours, new Date('2026-11-27T18:00:00.000Z'))).toBe(true);
    // 03:00 VN Saturday = 2026-11-27T20:00:00Z -> closed
    expect(isOpenNowVn(hours, new Date('2026-11-27T20:00:00.000Z'))).toBe(false);
    // 10:00 VN Saturday = 2026-11-28T03:00:00Z -> open
    expect(isOpenNowVn(hours, new Date('2026-11-28T03:00:00.000Z'))).toBe(true);
  });

  it('computes haversine distance accurately', () => {
    // Ben Thanh to Notre Dame Saigon (~950m)
    const dist = haversineMeters(10.7725, 106.698, 10.7798, 106.699);
    expect(dist).toBeGreaterThan(750);
    expect(dist).toBeLessThan(1000);
  });
});

describe('validateAttributeValues', () => {
  const defWifi = {
    _id: new Types.ObjectId(),
    key: 'wifi-speed',
    label: 'Wi-Fi',
    type: AttributeType.SINGLE_SELECT,
    options: ['Nhanh', 'Rất nhanh'],
    required: true,
    filterable: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const defTags = {
    _id: new Types.ObjectId(),
    key: 'vibes',
    label: 'Không gian',
    type: AttributeType.MULTI_SELECT,
    options: ['Yên tĩnh', 'Cây xanh'],
    required: false,
    filterable: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('validates SINGLE_SELECT, MULTI_SELECT and required enforcement on publish', () => {
    const cleaned = validateAttributeValues(
      [
        { definitionId: String(defWifi._id), value: 'Nhanh' },
        { definitionId: String(defTags._id), value: ['Yên tĩnh', 'Yên tĩnh'] },
      ],
      [defWifi, defTags],
      { category: PlaceCategory.CAFE, enforceRequired: true },
    );
    expect(cleaned).toEqual([
      { definitionId: String(defWifi._id), value: 'Nhanh' },
      { definitionId: String(defTags._id), value: ['Yên tĩnh'] },
    ]);

    // Missing required when publishing
    expect(() =>
      validateAttributeValues([], [defWifi], {
        category: PlaceCategory.CAFE,
        enforceRequired: true,
      }),
    ).toThrow(/Thuộc tính địa điểm/);

    // Invalid option
    expect(() =>
      validateAttributeValues([{ definitionId: String(defWifi._id), value: 'Chậm' }], [defWifi], {
        category: PlaceCategory.CAFE,
        enforceRequired: false,
      }),
    ).toThrow(/Thuộc tính địa điểm/);
  });
});

describe('toPublicPlaceDto redaction & bbox/filter parsing', () => {
  it('strips admin-only fields (sources, fieldStates, createdBy, deletedAt, _id) on public DTO', () => {
    const id = new Types.ObjectId();
    const creator = new Types.ObjectId();
    const doc = {
      _id: id,
      name: 'Cà phê Học Bài',
      nameNormalized: 'ca phe hoc bai',
      category: PlaceCategory.CAFE,
      address: { line1: '123 Lê Lợi', provinceCode: '79', countryCode: 'VN' as const },
      location: { type: 'Point' as const, coordinates: [106.7, 10.77] as [number, number] },
      images: [],
      hours: [],
      amenities: ['WIFI'],
      quietLevel: QuietLevel.QUIET,
      studySuitability: StudySuitability.BOTH,
      attributes: [],
      fieldStates: [{ path: 'name', verified: FieldVerifiedStatus.VERIFIED, locked: true }],
      sources: [{ provider: PlaceOrigin.OSM, providerPlaceId: 'node/123' }],
      origin: PlaceOrigin.OSM,
      status: PlaceStatus.PUBLISHED,
      ratingAverage: 4.5,
      ratingCount: 10,
      reviewCount: 10,
      createdBy: creator,
      version: 2,
      deletedAt: new Date(),
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-02T00:00:00Z'),
    };
    const pub = toPublicPlaceDto(doc, { isFavorite: true });
    expect(pub.id).toBe(String(id));
    expect(pub.location).toEqual({ lat: 10.77, lng: 106.7 });
    expect(pub.isFavorite).toBe(true);
    expect(pub).not.toHaveProperty('_id');
    expect(pub).not.toHaveProperty('sources');
    expect(pub).not.toHaveProperty('fieldStates');
    expect(pub).not.toHaveProperty('createdBy');
    expect(pub).not.toHaveProperty('deletedAt');

    const admin = toAdminPlaceDto(doc);
    expect(admin.sources).toHaveLength(1);
    expect(admin.fieldStates).toHaveLength(1);
    expect(admin.createdBy).toBe(String(creator));
  });

  it('rejects oversized bbox with MAP_BOUNDS_TOO_LARGE and parses attributeFilters', () => {
    expect(parseBbox('106.5,10.6,106.9,10.9')).toEqual([106.5, 10.6, 106.9, 10.9]);
    expect(() => parseBbox('100,8,108,15')).toThrow(/quá rộng/);
    expect(parseAttributeFilters('def1:Nhanh,def2:true')).toEqual({ def1: 'Nhanh', def2: true });
    expect(parseAttributeFilters('{"def1":"Nhanh","def2":false}')).toEqual({
      def1: 'Nhanh',
      def2: false,
    });
  });
});
