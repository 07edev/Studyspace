import { TaxonomyKind } from './schemas/taxonomy-item.schema';

export type TaxonomySeedEntry = {
  kind: TaxonomyKind;
  code: string;
  name: string;
  parentKind?: TaxonomyKind;
  parentCode?: string;
  sortOrder?: number;
};

// Static, deterministic Vietnam taxonomy & administrative seed dataset for G1.
// Upserted by { kind, code } so static ObjectIds stay stable across runs.
export const TAXONOMY_SEED_DATA: TaxonomySeedEntry[] = [
  // Place categories (matches PlaceCategory enum)
  { kind: TaxonomyKind.PLACE_CATEGORY, code: 'CAFE', name: 'Quán cà phê học tập', sortOrder: 1 },
  { kind: TaxonomyKind.PLACE_CATEGORY, code: 'LIBRARY', name: 'Thư viện', sortOrder: 2 },
  { kind: TaxonomyKind.PLACE_CATEGORY, code: 'COWORKING', name: 'Coworking Space', sortOrder: 3 },
  { kind: TaxonomyKind.PLACE_CATEGORY, code: 'STUDY_ROOM', name: 'Phòng tự học', sortOrder: 4 },
  { kind: TaxonomyKind.PLACE_CATEGORY, code: 'OTHER', name: 'Không gian khác', sortOrder: 5 },

  // Amenities
  { kind: TaxonomyKind.AMENITY, code: 'WIFI', name: 'Wi-Fi tốc độ cao', sortOrder: 1 },
  { kind: TaxonomyKind.AMENITY, code: 'POWER_OUTLET', name: 'Ổ cắm điện nhiều chỗ', sortOrder: 2 },
  { kind: TaxonomyKind.AMENITY, code: 'AIR_CONDITIONER', name: 'Điều hòa', sortOrder: 3 },
  { kind: TaxonomyKind.AMENITY, code: 'PARKING', name: 'Chỗ gửi xe', sortOrder: 4 },
  { kind: TaxonomyKind.AMENITY, code: 'QUIET_ZONE', name: 'Khu vực yên tĩnh', sortOrder: 5 },
  { kind: TaxonomyKind.AMENITY, code: 'MEETING_ROOM', name: 'Phòng họp nhóm', sortOrder: 6 },
  { kind: TaxonomyKind.AMENITY, code: 'PRINTING', name: 'In ấn / Photocopy', sortOrder: 7 },
  { kind: TaxonomyKind.AMENITY, code: 'DRINKS', name: 'Đồ uống', sortOrder: 8 },
  { kind: TaxonomyKind.AMENITY, code: 'FOOD', name: 'Đồ ăn nhẹ', sortOrder: 9 },
  { kind: TaxonomyKind.AMENITY, code: 'OPEN_LATE', name: 'Mở khuya / 24h', sortOrder: 10 },

  // Vietnam Provinces / Centrally-governed cities
  { kind: TaxonomyKind.PROVINCE, code: '79', name: 'TP. Hồ Chí Minh', sortOrder: 1 },
  { kind: TaxonomyKind.PROVINCE, code: '01', name: 'Hà Nội', sortOrder: 2 },
  { kind: TaxonomyKind.PROVINCE, code: '48', name: 'Đà Nẵng', sortOrder: 3 },
  { kind: TaxonomyKind.PROVINCE, code: '92', name: 'Cần Thơ', sortOrder: 4 },
  { kind: TaxonomyKind.PROVINCE, code: '31', name: 'Hải Phòng', sortOrder: 5 },
  { kind: TaxonomyKind.PROVINCE, code: '46', name: 'Huế', sortOrder: 6 },
  { kind: TaxonomyKind.PROVINCE, code: '74', name: 'Bình Dương', sortOrder: 7 },
  { kind: TaxonomyKind.PROVINCE, code: '75', name: 'Đồng Nai', sortOrder: 8 },

  // Wards (linked to Province via parentCode)
  { kind: TaxonomyKind.WARD, code: '79-BN', name: 'Phường Bến Nghé', parentKind: TaxonomyKind.PROVINCE, parentCode: '79', sortOrder: 1 },
  { kind: TaxonomyKind.WARD, code: '79-BT', name: 'Phường Bến Thành', parentKind: TaxonomyKind.PROVINCE, parentCode: '79', sortOrder: 2 },
  { kind: TaxonomyKind.WARD, code: '79-LT', name: 'Phường Linh Trung', parentKind: TaxonomyKind.PROVINCE, parentCode: '79', sortOrder: 3 },
  { kind: TaxonomyKind.WARD, code: '79-TD', name: 'Phường Thảo Điền', parentKind: TaxonomyKind.PROVINCE, parentCode: '79', sortOrder: 4 },
  { kind: TaxonomyKind.WARD, code: '79-VTS', name: 'Phường Võ Thị Sáu', parentKind: TaxonomyKind.PROVINCE, parentCode: '79', sortOrder: 5 },
  { kind: TaxonomyKind.WARD, code: '01-BK', name: 'Phường Bách Khoa', parentKind: TaxonomyKind.PROVINCE, parentCode: '01', sortOrder: 1 },
  { kind: TaxonomyKind.WARD, code: '01-DV', name: 'Phường Dịch Vọng', parentKind: TaxonomyKind.PROVINCE, parentCode: '01', sortOrder: 2 },
  { kind: TaxonomyKind.WARD, code: '01-HT', name: 'Phường Hàng Trống', parentKind: TaxonomyKind.PROVINCE, parentCode: '01', sortOrder: 3 },
  { kind: TaxonomyKind.WARD, code: '01-LH', name: 'Phường Láng Hạ', parentKind: TaxonomyKind.PROVINCE, parentCode: '01', sortOrder: 4 },
  { kind: TaxonomyKind.WARD, code: '48-HC', name: 'Phường Hải Châu', parentKind: TaxonomyKind.PROVINCE, parentCode: '48', sortOrder: 1 },
  { kind: TaxonomyKind.WARD, code: '48-MA', name: 'Phường Mỹ An', parentKind: TaxonomyKind.PROVINCE, parentCode: '48', sortOrder: 2 },
  { kind: TaxonomyKind.WARD, code: '48-HK', name: 'Phường Hòa Khánh Bắc', parentKind: TaxonomyKind.PROVINCE, parentCode: '48', sortOrder: 3 },
  { kind: TaxonomyKind.WARD, code: '92-XK', name: 'Phường Xuân Khánh', parentKind: TaxonomyKind.PROVINCE, parentCode: '92', sortOrder: 1 },
  { kind: TaxonomyKind.WARD, code: '46-PN', name: 'Phường Phú Nhuận', parentKind: TaxonomyKind.PROVINCE, parentCode: '46', sortOrder: 1 },

  // Universities
  { kind: TaxonomyKind.UNIVERSITY, code: 'HCMUS', name: 'Đại học Khoa học Tự nhiên - ĐHQG TP.HCM', sortOrder: 1 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'HCMUT', name: 'Đại học Bách khoa - ĐHQG TP.HCM', sortOrder: 2 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'UIT', name: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM', sortOrder: 3 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'UEH', name: 'Đại học Kinh tế TP.HCM', sortOrder: 4 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'HUST', name: 'Đại học Bách khoa Hà Nội', sortOrder: 5 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'UET', name: 'Đại học Công nghệ - ĐHQG Hà Nội', sortOrder: 6 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'DUT', name: 'Đại học Bách khoa - Đại học Đà Nẵng', sortOrder: 7 },
  { kind: TaxonomyKind.UNIVERSITY, code: 'FPTU', name: 'Đại học FPT', sortOrder: 8 },

  // Majors (linked to Universities)
  { kind: TaxonomyKind.MAJOR, code: 'HCMUS-CS', name: 'Khoa học máy tính', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HCMUS', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'HCMUS-SE', name: 'Kỹ thuật phần mềm', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HCMUS', sortOrder: 2 },
  { kind: TaxonomyKind.MAJOR, code: 'HCMUS-DS', name: 'Khoa học dữ liệu', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HCMUS', sortOrder: 3 },
  { kind: TaxonomyKind.MAJOR, code: 'HCMUT-CS', name: 'Khoa học máy tính', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HCMUT', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'HCMUT-CE', name: 'Kỹ thuật máy tính', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HCMUT', sortOrder: 2 },
  { kind: TaxonomyKind.MAJOR, code: 'UIT-SE', name: 'Kỹ thuật phần mềm', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'UIT', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'UIT-IS', name: 'An toàn thông tin', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'UIT', sortOrder: 2 },
  { kind: TaxonomyKind.MAJOR, code: 'UEH-FIN', name: 'Tài chính - Ngân hàng', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'UEH', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'UEH-MKT', name: 'Marketing', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'UEH', sortOrder: 2 },
  { kind: TaxonomyKind.MAJOR, code: 'HUST-IT', name: 'Khoa học máy tính', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HUST', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'HUST-DS', name: 'Khoa học dữ liệu & AI', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'HUST', sortOrder: 2 },
  { kind: TaxonomyKind.MAJOR, code: 'UET-CS', name: 'Công nghệ thông tin', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'UET', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'DUT-IT', name: 'Công nghệ thông tin', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'DUT', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'FPTU-SE', name: 'Kỹ thuật phần mềm', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'FPTU', sortOrder: 1 },
  { kind: TaxonomyKind.MAJOR, code: 'FPTU-AI', name: 'Trí tuệ nhân tạo', parentKind: TaxonomyKind.UNIVERSITY, parentCode: 'FPTU', sortOrder: 2 },

  // Subjects
  { kind: TaxonomyKind.SUBJECT, code: 'DSA', name: 'Cấu trúc dữ liệu & Giải thuật', sortOrder: 1 },
  { kind: TaxonomyKind.SUBJECT, code: 'WEB', name: 'Phát triển ứng dụng Web', sortOrder: 2 },
  { kind: TaxonomyKind.SUBJECT, code: 'MOBILE', name: 'Phát triển ứng dụng Di động', sortOrder: 3 },
  { kind: TaxonomyKind.SUBJECT, code: 'DB', name: 'Cơ sở dữ liệu', sortOrder: 4 },
  { kind: TaxonomyKind.SUBJECT, code: 'OS', name: 'Hệ điều hành', sortOrder: 5 },
  { kind: TaxonomyKind.SUBJECT, code: 'NET', name: 'Mạng máy tính', sortOrder: 6 },
  { kind: TaxonomyKind.SUBJECT, code: 'AI', name: 'Trí tuệ nhân tạo', sortOrder: 7 },
  { kind: TaxonomyKind.SUBJECT, code: 'ML', name: 'Học máy', sortOrder: 8 },
  { kind: TaxonomyKind.SUBJECT, code: 'CALC', name: 'Giải tích', sortOrder: 9 },
  { kind: TaxonomyKind.SUBJECT, code: 'PROB', name: 'Xác suất thống kê', sortOrder: 10 },
  { kind: TaxonomyKind.SUBJECT, code: 'ENG', name: 'Tiếng Anh học thuật / IELTS', sortOrder: 11 },
  { kind: TaxonomyKind.SUBJECT, code: 'ECON', name: 'Kinh tế học', sortOrder: 12 },
  { kind: TaxonomyKind.SUBJECT, code: 'MKT', name: 'Marketing căn bản', sortOrder: 13 },
  { kind: TaxonomyKind.SUBJECT, code: 'ACC', name: 'Kế toán tài chính', sortOrder: 14 },
];
