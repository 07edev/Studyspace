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
| M1 | `be` | `phuc/feature/be/taxonomy-locations` | P01 (BE) | DOING |
| M2 | `be` | `phuc/feature/be/places-public-attributes` | P05 + P02 (BE) | TODO |
| M3 | `be` | `phuc/feature/be/admin-places` | P03 (BE) | TODO |
| M4 | `be` | `phuc/feature/be/place-providers` | P04 (BE) | TODO |
| M5 | `be` | `phuc/feature/be/favorites-reviews` | P06 + P07 (BE) | TODO |
| M6 | `be` | `phuc/feature/be/place-suggestions` | P08 + P09 (BE) | TODO |
| M7 | `web-admin` | `phuc/feature/web-admin/places-management` | P03 + P04 + P05 (Web) | TODO |
| M8 | `web-admin` | `phuc/feature/web-admin/suggestions-reviews` | P07 + P09 (Web) | TODO |
| M9 | `app` | `phuc/feature/app/taxonomy-explore-places` | P01 + P02 + P10 (App) | TODO |
| M10 | `app` | `phuc/feature/app/favorites-reviews-suggestions` | P06 + P07 + P08 + P10 (App) | TODO |

## 3. Nhật ký tiến độ và bằng chứng kiểm tra

| Ngày | Milestone | Việc đã làm | Bằng chứng kiểm tra / Giới hạn |
| --- | --- | --- | --- |
| 28/11/2026 | M0 | Tạo tài liệu theo dõi TV2, shared contract `src/shared/contracts/places.ts`, cấu hình `placeProviders` trong `backend/src/config/configuration.ts` & `.env.example` | `backend` typecheck + build đạt; `web-admin` typecheck + build đạt; App `lint` + `typecheck` đạt. Lưu ý: máy dev hiện chưa bật MongoDB local (`127.0.0.1:27017`) / Docker daemon |
