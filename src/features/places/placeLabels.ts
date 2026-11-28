import type {
  Address,
  DayOfWeek,
  PlaceCategory,
  PriceRange,
  QuietLevel,
  StudySuitability,
  SuggestionStatus,
  SuggestionType,
} from '../../shared/contracts/places';

export type PlaceSort = 'DISTANCE' | 'RATING' | 'UPDATED' | 'POPULAR';

export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  CAFE: 'Quán cà phê',
  LIBRARY: 'Thư viện',
  COWORKING: 'Coworking',
  STUDY_ROOM: 'Phòng học',
  OTHER: 'Khác',
};

export const QUIET_LEVEL_LABEL: Record<QuietLevel, string> = {
  VERY_QUIET: 'Rất yên tĩnh',
  QUIET: 'Yên tĩnh',
  MODERATE: 'Vừa phải',
  NOISY: 'Ồn ào',
  UNKNOWN: 'Chưa rõ',
};

export const STUDY_SUITABILITY_LABEL: Record<StudySuitability, string> = {
  SOLO: 'Học một mình',
  GROUP: 'Học nhóm',
  BOTH: 'Cả một mình & nhóm',
  UNKNOWN: 'Chưa rõ',
};

export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  MON: 'Thứ 2',
  TUE: 'Thứ 3',
  WED: 'Thứ 4',
  THU: 'Thứ 5',
  FRI: 'Thứ 6',
  SAT: 'Thứ 7',
  SUN: 'Chủ nhật',
};

export const PLACE_SORT_OPTIONS: { value: PlaceSort; label: string; description: string }[] = [
  { value: 'RATING', label: 'Đánh giá cao nhất', description: 'Ưu tiên nơi có điểm đánh giá tốt' },
  { value: 'DISTANCE', label: 'Gần bạn nhất', description: 'Ưu tiên khoảng cách gần vị trí hiện tại' },
  { value: 'UPDATED', label: 'Mới cập nhật', description: 'Thông tin vừa được làm mới gần đây' },
  { value: 'POPULAR', label: 'Phổ biến nhất', description: 'Nhiều sinh viên đánh giá và quan tâm' },
];

export const SUGGESTION_TYPE_LABEL: Record<SuggestionType, string> = {
  CREATE: 'Đề xuất địa điểm mới',
  UPDATE: 'Gợi ý chỉnh sửa thông tin',
};

export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã được duyệt',
  REJECTED: 'Đã từ chối',
};

export const SUGGESTABLE_FIELDS: { path: string; label: string; placeholder: string }[] = [
  { path: 'name', label: 'Tên địa điểm', placeholder: 'Nhập tên mới' },
  { path: 'address.line1', label: 'Địa chỉ', placeholder: 'Số nhà, tên đường' },
  { path: 'phone', label: 'Số điện thoại', placeholder: '+84901234567' },
  { path: 'website', label: 'Website', placeholder: 'https://...' },
  { path: 'description', label: 'Mô tả', placeholder: 'Mô tả ngắn về không gian học tập' },
  { path: 'quietLevel', label: 'Độ yên tĩnh', placeholder: 'VERY_QUIET / QUIET / MODERATE / NOISY' },
  { path: 'studySuitability', label: 'Phù hợp học tập', placeholder: 'SOLO / GROUP / BOTH' },
];

export const formatAddress = (address?: Address): string =>
  address?.displayText || [address?.line1, address?.wardCode, address?.provinceCode].filter(Boolean).join(', ') || '';

export const formatPriceRange = (price?: PriceRange): string => {
  if (!price) {
    return 'Chưa có thông tin giá';
  }
  const fmt = new Intl.NumberFormat('vi-VN');
  const range = `${fmt.format(price.minVnd)} – ${fmt.format(price.maxVnd)} đ`;
  return price.note ? `${range} · ${price.note}` : range;
};

export const formatDistance = (meters?: number): string | undefined => {
  if (meters === undefined || !Number.isFinite(meters)) {
    return undefined;
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};
