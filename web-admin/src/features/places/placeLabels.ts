import type {
  Address,
  AttributeType,
  DayOfWeek,
  FieldVerifiedStatus,
  GeoPoint,
  OpeningDay,
  PlaceCategory,
  PlaceOrigin,
  PlaceStatus,
  PriceRange,
  QuietLevel,
  ReviewStatus,
  StudySuitability,
  SuggestionStatus,
  SuggestionType,
} from '@contracts/places';

export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  CAFE: 'Quán cà phê',
  LIBRARY: 'Thư viện',
  COWORKING: 'Coworking space',
  STUDY_ROOM: 'Phòng học',
  OTHER: 'Khác',
};
export const PLACE_CATEGORY_OPTIONS = (Object.entries(PLACE_CATEGORY_LABEL) as [PlaceCategory, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const PLACE_ORIGIN_LABEL: Record<PlaceOrigin, string> = {
  MANUAL: 'Nhập thủ công',
  OSM: 'OpenStreetMap',
  WIKIDATA: 'Wikidata',
  GOOGLE_PLACES: 'Google Places',
  MIXED: 'Tổng hợp',
  USER_SUGGESTION: 'Đề xuất người dùng',
};
export const PLACE_ORIGIN_OPTIONS = (Object.entries(PLACE_ORIGIN_LABEL) as [PlaceOrigin, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const PLACE_STATUS_LABEL: Record<PlaceStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang hiển thị',
  HIDDEN: 'Đã ẩn',
  DELETED: 'Đã xóa',
};
export const PLACE_STATUS_TONE: Record<PlaceStatus, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  DELETED: 'danger',
};
export const PLACE_STATUS_OPTIONS = (Object.entries(PLACE_STATUS_LABEL) as [PlaceStatus, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const QUIET_LEVEL_LABEL: Record<QuietLevel, string> = {
  VERY_QUIET: 'Rất yên tĩnh',
  QUIET: 'Yên tĩnh',
  MODERATE: 'Vừa phải',
  NOISY: 'Ồn ào',
  UNKNOWN: 'Chưa rõ',
};
export const QUIET_LEVEL_OPTIONS = (Object.entries(QUIET_LEVEL_LABEL) as [QuietLevel, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const STUDY_SUITABILITY_LABEL: Record<StudySuitability, string> = {
  SOLO: 'Học một mình',
  GROUP: 'Học nhóm',
  BOTH: 'Cả hai',
  UNKNOWN: 'Chưa rõ',
};
export const STUDY_SUITABILITY_OPTIONS = (Object.entries(STUDY_SUITABILITY_LABEL) as [StudySuitability, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const DAY_OF_WEEK_ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  MON: 'Thứ 2',
  TUE: 'Thứ 3',
  WED: 'Thứ 4',
  THU: 'Thứ 5',
  FRI: 'Thứ 6',
  SAT: 'Thứ 7',
  SUN: 'Chủ nhật',
};

export const FIELD_VERIFIED_LABEL: Record<FieldVerifiedStatus, string> = {
  UNVERIFIED: 'Chưa xác minh',
  VERIFIED: 'Đã xác minh',
  DISPUTED: 'Cần đối chiếu',
};
export const FIELD_VERIFIED_TONE: Record<FieldVerifiedStatus, 'neutral' | 'success' | 'warning'> = {
  UNVERIFIED: 'neutral',
  VERIFIED: 'success',
  DISPUTED: 'warning',
};

export const ATTRIBUTE_TYPE_LABEL: Record<AttributeType, string> = {
  TEXT: 'Văn bản',
  NUMBER: 'Số',
  BOOLEAN: 'Có / Không',
  SINGLE_SELECT: 'Chọn một',
  MULTI_SELECT: 'Chọn nhiều',
};
export const ATTRIBUTE_TYPE_OPTIONS = (Object.entries(ATTRIBUTE_TYPE_LABEL) as [AttributeType, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PUBLISHED: 'Đang hiển thị',
  HIDDEN: 'Đã ẩn',
  DELETED: 'Đã xóa',
};
export const REVIEW_STATUS_TONE: Record<ReviewStatus, 'success' | 'warning' | 'danger'> = {
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  DELETED: 'danger',
};

export const SUGGESTION_TYPE_LABEL: Record<SuggestionType, string> = {
  CREATE: 'Thêm địa điểm mới',
  UPDATE: 'Cập nhật thông tin',
};
export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};
export const SUGGESTION_STATUS_TONE: Record<SuggestionStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const PLACE_FIELD_LABEL: Record<string, string> = {
  name: 'Tên địa điểm',
  category: 'Danh mục',
  description: 'Mô tả',
  address: 'Địa chỉ',
  'address.line1': 'Số nhà, đường',
  'address.wardCode': 'Phường / Xã',
  'address.provinceCode': 'Tỉnh / Thành phố',
  location: 'Tọa độ',
  phone: 'Số điện thoại',
  website: 'Website',
  images: 'Hình ảnh',
  hours: 'Giờ mở cửa',
  price: 'Khoảng giá',
  amenities: 'Tiện ích',
  quietLevel: 'Độ yên tĩnh',
  studySuitability: 'Phù hợp học tập',
  attributes: 'Thuộc tính bổ sung',
  status: 'Trạng thái',
};

export const GOVERNED_FIELD_PATHS = [
  'name',
  'category',
  'address',
  'location',
  'hours',
  'price',
  'amenities',
  'phone',
  'website',
  'quietLevel',
  'studySuitability',
  'description',
  'images',
  'attributes',
] as const;

export const placeFieldLabel = (path: string) => PLACE_FIELD_LABEL[path] ?? path;

export const formatAddress = (address?: Address) =>
  address?.displayText || [address?.line1, address?.wardCode, address?.provinceCode].filter(Boolean).join(', ') || '—';

export const formatCoords = (loc?: GeoPoint) =>
  loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : '—';

export const formatPriceRange = (price?: PriceRange) => {
  if (!price) return 'Chưa cập nhật';
  const fmt = new Intl.NumberFormat('vi-VN');
  const range = `${fmt.format(price.minVnd)} – ${fmt.format(price.maxVnd)} đ`;
  return price.note ? `${range} (${price.note})` : range;
};

export const defaultOpeningHours = (): OpeningDay[] =>
  DAY_OF_WEEK_ORDER.map(day => ({
    day,
    closed: false,
    intervals: [{ open: '08:00', close: '22:00', overnight: false }],
  }));

export const summarizeHours = (hours?: OpeningDay[]): string => {
  if (!hours || hours.length === 0) return 'Chưa thiết lập giờ mở cửa';
  const openDays = hours.filter(h => !h.closed && h.intervals.length > 0);
  if (openDays.length === 0) return 'Đóng cửa tất cả các ngày';
  const sample = openDays[0].intervals[0];
  return `${openDays.length}/7 ngày mở cửa (vd: ${sample.open}–${sample.close}${sample.overnight ? ' +1 ngày' : ''})`;
};
