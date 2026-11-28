# Kế hoạch triển khai StudySpace — Thành viên 2 (TV2: Places & Explore)

Ngày lập: 28/11/2026. Chủ sở hữu: TV2 (Places, Explore, Taxonomy, Reviews, Favorites, Place Suggestions).

## 1. Quyết định kỹ thuật đã chốt

| Hạng mục | Quyết định |
| --- | --- |
| Bản đồ | Web Admin: `leaflet` + OpenStreetMap tiles. Mobile App: `react-native-webview` + Leaflet + OSM tiles |
| Nguồn ngoài (`P04`) | OSM (Overpass/Nominatim) + Wikidata chạy thật tại BE; Google Places là adapter tùy chọn theo `GOOGLE_PLACES_API_KEY` |
| Phối hợp TV3 | Phát triển độc lập trên `main` (Phương án A): dùng cổng `PlaceFileRef`, sự kiện Outbox `SUGGESTION_DECIDED`, hàm `moderateFromReport`, và `UserContentRegistry` |
| Nhánh Git | `phuc/feature/{be\|web-admin\|app}/{chuc-nang}` theo mô hình stacked branches `M0 → M10`, tự push từng nhánh, không push vào `main` |

## 2. Lộ trình 11 Milestone (`M0 → M10`)

| Milestone | Lớp | Nhánh Git | Task báo cáo | Trạng thái |
| --- | --- | --- | --- | --- |
| M0 | `be` | `phuc/feature/be/setup-contracts-config` | Khởi tạo | DONE |
| M1 | `be` | `phuc/feature/be/taxonomy-locations` | P01 (BE) | DONE (e2e chờ DB) |
| M2 | `be` | `phuc/feature/be/places-public-attributes` | P05 + P02 (BE) | DONE (e2e chờ DB) |
| M3 | `be` | `phuc/feature/be/admin-places` | P03 (BE) | DONE (e2e chờ DB) |
| M4 | `be` | `phuc/feature/be/place-providers` | P04 (BE) | DONE (e2e chờ DB) |
| M5 | `be` | `phuc/feature/be/favorites-reviews` | P06 + P07 (BE) | DONE (e2e chờ DB) |
| M6 | `be` | `phuc/feature/be/place-suggestions` | P08 + P09 (BE) | DONE (e2e chờ DB) |
| M7 | `web-admin` | `phuc/feature/web-admin/places-management` | P03 + P04 + P05 (Web) | DONE |
| M8 | `web-admin` | `phuc/feature/web-admin/suggestions-reviews` | P07 + P09 (Web) | DONE |
| M9 | `app` | `phuc/feature/app/taxonomy-explore-places` | P01 + P02 + P10 (App) | DONE |
| M10 | `app` | `phuc/feature/app/favorites-reviews-suggestions` | P06 + P07 + P08 + P10 (App) | DOING |

## 3. Nhật ký tiến độ và bằng chứng kiểm tra

| Ngày | Milestone | Việc đã làm | Bằng chứng kiểm tra / Giới hạn |
| --- | --- | --- | --- |
| 28/11/2026 | M0 | Tạo tài liệu theo dõi TV2, shared contract `src/shared/contracts/places.ts`, cấu hình `placeProviders` trong `backend/src/config/configuration.ts` & `.env.example` | `backend` typecheck + build đạt; `web-admin` typecheck + build đạt; App `lint` + `typecheck` đạt. Lưu ý: máy dev hiện chưa bật MongoDB local (`127.0.0.1:27017`) / Docker daemon |
| 28/11/2026 | M1 | Triển khai `TaxonomyModule` (7 API công khai), `seed:taxonomy` idempotent dữ liệu VN, nối `Tv2TaxonomyRef` vào `UsersModule`, cập nhật `users.e2e.spec.ts`, thêm `taxonomy.unit.spec.ts` & `taxonomy.e2e.spec.ts` | `backend` typecheck + build + `taxonomy.unit.spec.ts` (6/6) đạt; e2e chờ MongoDB local |
| 28/11/2026 | M2 | Triển khai `PlacesModule` (schemas `places` 2dsphere, `place_attribute_definitions`, `place_history`), validator thuộc tính động, giờ mở cửa UTC+7 (`openNow`), 4 API thuộc tính + 6 API public redacted, seed thuộc tính mặc định | `backend` typecheck + build + unit tests (`taxonomy.unit.spec.ts`, `places-public.unit.spec.ts`) đạt; e2e chờ MongoDB local |
| 28/11/2026 | M3 | Triển khai 7 API `AdminPlaces` (CRUD, CAS `version`, khóa/xác minh `fieldStates`, soft delete, `place_history`, `AuditService`, `moderateFromReport`), cổng `PlaceFileRef`, `PlacesStatsContributor` đăng ký `StatsRegistry`, cô lập `stats.e2e.spec.ts` | `backend` typecheck + build + unit tests (`admin-places.unit.spec.ts` + toàn bộ unit tests trước đó) đạt; e2e chờ MongoDB local |
| 28/11/2026 | M4 | Triển khai `PlaceProvidersService` (OSM Nominatim + Wikidata + Google Places optional), `CandidateTokenService` (HMAC + TTL), `DuplicateCheckService` (bán kính + tên chuẩn hóa), 2 API `place-candidates/search` & `duplicate-check`, nối vào `AdminPlacesService.create` | `backend` typecheck + build + unit tests (`place-providers.unit.spec.ts` + toàn bộ unit tests trước đó) đạt; e2e chờ MongoDB local |
| 28/11/2026 | M5 | Nâng cấp `UserContentRegistry` tương thích ngược TV1/TV3, triển khai `FavoritesModule` (3 API + `isFavorite`), `ReviewsModule` (8 API, unique partial index, tính lại `ratingAverage`/`ratingCount`, moderation + `AuditService`, `moderateFromReport`) | `backend` typecheck + build + unit tests (`favorites-reviews.unit.spec.ts` + toàn bộ unit tests trước đó) đạt; e2e chờ MongoDB local |
| 28/11/2026 | M6 | Triển khai `PlaceSuggestionsModule` (7 API user/admin, allow-list `fieldPath`, kiểm `fieldStates.locked`, CAS `expectedVersion`, `@Idempotent()`, `runInOptionalTransaction`, `place_history`, `AuditService`, `OutboxService` `SUGGESTION_DECIDED`, `pendingSuggestions` Stats, `UserContentRegistry`). Chốt đủ 44/44 API Backend TV2 | `backend` typecheck + build + 6/6 bộ unit tests đạt; e2e chờ MongoDB local |
| 28/11/2026 | M7 | Cài `leaflet` + `@types/leaflet`, mở rộng `queryKeys` & nhãn Audit TV2, triển khai 4 trang Web Admin (`ADM-06` PlacesPage, `ADM-08` PlaceImportPage, `ADM-09` PlaceFormPage, `ADM-10` PlaceDetailPage) và đầy đủ modal `A12–A27` (bản đồ OSM, giờ mở cửa 7 ngày, thuộc tính động, quản lý ảnh, kiểm tra trùng, xác minh/khóa trường, diff lịch sử) + `places.test.tsx` | `web-admin` typecheck + Vite build + Vitest 10/10 files (118/118 tests, Node v24.15.0) đạt |
| 28/11/2026 | M8 | Triển khai `ADM-13` SuggestionsPage (+ `A28`), `ADM-14` SuggestionDetailPage (+ `A15`, `A29`, `A30`, `A31` với `expectedVersion` & `Idempotency-Key`), `ADM-15` ReviewsPage (+ `A32`, `A33`, `A34`), nâng cấp bảng tab `reviews` & `suggestions` trong `UserDetailPage` (`ADM-04`), thêm `suggestions.test.tsx` & `reviews.test.tsx`. Hoàn tất 7/7 trang & 23/23 modal Web Admin TV2 | `web-admin` typecheck + Vite build + Vitest 12/12 files (125/125 tests, Node v24.15.0) đạt |
| 28/11/2026 | M9 | Cài `react-native-webview` (+ mock trong `jest.setup.js`), mở rộng `queryKeys` & `ModalHost` (`scrollable`), xây `ExploreProvider`, `MapCanvas` (WebView + Leaflet + OSM), `PlaceCard`, `TaxonomyPickers` (`U07` trường/ngành, `U08` <=30 môn, `U09` tỉnh/xã nối vào `ProfileEditForm`), `HomeScreen` (`USR-07`), `ExploreScreen` (`USR-08` Danh sách + Bản đồ + `MAP_BOUNDS_TOO_LARGE`), `PlaceModals` (`U10–U14`, yêu thích optimistic + AuthGate) + `placesExplore.test.tsx` | Mobile `eslint .` + `tsc --noEmit` + Jest 8/8 suites (112/112 tests, 0 lỗi, thoát sạch) đạt |
