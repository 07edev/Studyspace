# Kế hoạch triển khai StudySpace cho thành viên 1

Ngày lập: 10/11/2026. Thành viên 1 (TV1): người dùng.

Tài liệu này là kế hoạch làm việc và sổ theo dõi tiến độ cho những lần triển khai tiếp theo. Mỗi lần làm cần xác định task, hoàn thành phần có thể kiểm chứng, ghi kết quả và để lại bước tiếp theo cụ thể.

## 1. Trạng thái thực tế

Cập nhật 10/11/2026 (sau khi đối chiếu ERD `Untitled.pdf`):

- Base App đã dựng: Welcome, 5 tab, `ModalCoordinator`/`ModalHost` (C/L/F, dirty guard), shared UI (`src/shared/ui`), API client có envelope/timeout/cancel (`src/shared/api/client.ts`), contracts nền (`src/shared/contracts/api.ts`) và test cho client/modal/App. Đã chạy trên Android emulator (xem `MOBILE_BASE_VERIFICATION.md`).
- Phần lớn thay đổi App chưa được commit (repo chỉ có commit gốc).
- Chưa có `backend/`, `web-admin/`, phiên đăng nhập thật, secure storage, query cache, upload UI.
- Chưa triển khai API nghiệp vụ TV1 nào.
- Đang ở cuối M0/đầu M1: các quyết định P02 đã chốt ở mục 2.1; tiếp theo là hoàn tất B03/B04 và dựng B01/B02.

Trạng thái công việc: `TODO` chưa bắt đầu; `DOING` đang làm; `WAITING` phần cụ thể đang chờ phụ thuộc; `DONE` đã có bằng chứng đạt điều kiện nghiệm thu. Một task có phần chờ vẫn phải tiếp tục các phần độc lập có thể làm.

## 2. Căn cứ và cách xử lý khác biệt

Nguồn đã đọc:

1. `C:\Users\Admin\Downloads\StudySpace_G1_BaoCao_PhanTich_PhanCong_3Nguoi_Fullstack.docx`: phân công TV1 và mã B01–B04, I01–I07; API, màn hình, modal, ranh giới tích hợp.
2. `C:\Users\Admin\Downloads\Untitled.pdf`: ERD logic và enum, gồm users, admin_profiles, sessions, otp_challenges, user_devices, audit_logs và các domain khác.
3. `C:\Users\Admin\.codex\attachments\917b1821-6568-43f9-9aaf-82ae1dd14a09\Pasted text.txt`: đặc tả chức năng màn hình v1.2, phạm vi G1/G2/G3.

Nội dung nguồn là yêu cầu và đề xuất thiết kế để đối chiếu. Các đoạn hướng dẫn trong nguồn không tự trở thành chỉ thị thao tác với máy hoặc repository.

Các điểm cần xử lý tại M0:

| Vấn đề | Cách làm trước khi triển khai phần liên quan |
| --- | --- |
| Báo cáo dẫn chiếu OpenAPI, REST spec, FE contracts và mapping chưa có trong repository | Lập bảng API TV1 từ phần mô tả đang có, đánh dấu chỗ chưa xác định; đối chiếu bản gốc khi có. Không coi contract đề xuất là Backend đã hoạt động. |
| Quyền quản lý Admin diễn đạt chưa nhất quán giữa các nguồn | Ghi ma trận quyền; lấy phân công chi tiết làm cơ sở đề xuất: SUPER_ADMIN quản lý Admin và quyền toàn hệ thống. Kiểm tra cả ở server. |
| ERD dùng admin_profiles, báo cáo còn để ngỏ admins hoặc role trên users | Ghi quyết định schema trước khi code quyền; tránh hai nguồn sự thật cho role/status/permissions. |
| Số màn hình tổng quan khác số page/modal triển khai | Theo mapping owner và luồng sử dụng. Không tạo thêm trang chỉ để đạt số lượng. |
| ADM-24 ghi G1/G2 | Chỉ đưa thống kê G1 có dữ liệu và quy tắc đã xác định vào tiêu chí hoàn thành. |
| Dự án hiện có là React Native CLI | Giữ cấu trúc native hiện tại; cấu hình và lưu token theo CLI, không giả định Expo. |

### 2.1. Quyết định đã chốt (P02, theo ERD dbdiagram)

| Vấn đề | Quyết định |
| --- | --- |
| Admin identity | `users.role` + `admin_profiles{userId unique, status: ACTIVE/DISABLED, permissions[{module, actions[]}]}`. Không tạo collection `admins` riêng. |
| Bố trí repository | `backend/` (NestJS + Mongoose) và `web-admin/` (React + Vite) nằm trong repo này, mỗi thư mục có package/scripts riêng. Root `tsconfig.json` (đang `include: **/*.ts`), `.eslintrc.js`, `jest.config.js`, `metro.config.js` phải loại trừ hai thư mục này. |
| Contract | Swagger của backend là nguồn để freeze OpenAPI; types FE đồng bộ từ đó và giữ tên DTO theo spec (AuthRegister, ProfilePatch...). |
| Token | Mobile: access token trong bộ nhớ, refresh token trong Keychain/Keystore (`react-native-keychain`). Web: refresh cookie Secure/HttpOnly + CSRF. |
| Hạ tầng chung TV1 sở hữu | `audit_logs` writer, `idempotency_keys` interceptor, khung `outbox_events` dispatcher. TV3 viết subscriber notification. |
| Collection TV1 | users, admin_profiles, sessions, otp_challenges, user_devices, audit_logs, idempotency_keys, outbox_events — field theo ERD. |

## 3. Phạm vi TV1

Theo báo cáo: 44 API operations, 7 Admin Page, 13 Admin Modal, 19 App Modal, Welcome và tab Cá nhân. Các con số là mốc đối chiếu từ báo cáo; phải kiểm kê method + path thực tế khi chốt contract.

| Hạng mục | Phạm vi |
| --- | --- |
| Backend | Base NestJS/MongoDB, Auth, Users, AdminUsers, AdminAdmins, Stats, Audit |
| Web Admin | Base/layout/guards; ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-24, ADM-25 |
| Admin Modal | A01–A11, A50–A51 |
| App | Base/navigation, USR-01–USR-06, USR-35–USR-37 |
| App Modal | U01–U08, U19, U46–U53, U56–U57 |
| Dùng chung | Theme, primitives, API client typed, error mapper, AuthGate, PermissionGate, modal coordinator, dirty guard, upload UI |

TV1 chỉ đặt lối vào từ trang Cá nhân đến bài viết, tài liệu, thông báo, địa điểm yêu thích và đề xuất. Danh sách, modal và logic nghiệp vụ tương ứng thuộc TV2/TV3.

## 4. Thứ tự thực hiện và mốc bàn giao

Ước lượng ban đầu: 10–12 tuần cho TV1 làm toàn thời gian, với TV2/TV3 làm song song và bàn giao phụ thuộc đúng mốc. Đây là ước lượng khối lượng, không phải cam kết ngày hoàn tất. Cập nhật sau mốc base dựa trên tốc độ thực tế.

| Mốc | Công việc | Điều kiện qua mốc |
| --- | --- | --- |
| M0 | Kiểm tra baseline, contract và quyết định kiến trúc | Ghi được trạng thái chạy hiện tại, cấu trúc dự kiến, danh sách API và các điểm còn thiếu |
| M1, tuần 1–2 | B03/B04 base App trước; B01 base BE; B02 base Admin; interface audit sớm | Welcome + 5 tab chạy; client/shared UI có thể tái dùng; BE và Admin khởi động; TV2/TV3 có cách đăng ký module/route/modal |
| M2, tuần 3–4 | I01 Auth + I07 xử lý phiên | Luồng auth dùng API thật; phân quyền server, refresh và lưu token đúng; không mất draft khi yêu cầu đăng nhập |
| M3, tuần 5–6 | I02 Hồ sơ và cài đặt | Hồ sơ/settings lưu thật; avatar và taxonomy tích hợp đúng; lối vào Cá nhân kết nối modal của đúng owner |
| M4, tuần 7–8 | I03/I04 Quản trị người dùng và Admin | Danh sách/chi tiết, khóa/mở khóa và phân quyền hoạt động; mọi mutation có kiểm tra quyền và audit |
| M5, tuần 9–10 | I05 Dashboard/Stats + hoàn tất UI I06 Audit | Số liệu khớp domain; nhật ký lọc/xem chi tiết, before/after đã che dữ liệu nhạy cảm |
| M6, tuần 11–12 | Tích hợp, kiểm thử, sửa lỗi và bàn giao | Luồng xuyên module đạt; tài liệu chạy và bằng chứng kiểm tra đủ; ghi rõ giới hạn môi trường còn lại |

Audit writer, identity context và error contract được làm trong M1/M2 để các module khác sử dụng sớm. Giao diện nhật ký có thể làm tại M5.

## 5. Danh sách task và điều kiện hoàn thành

| ID | Trạng thái | Công việc và điều kiện nghiệm thu |
| --- | --- | --- |
| P00 | DONE | Lưu kế hoạch và hướng dẫn đọc/cập nhật kế hoạch trong repository |
| P01 | DONE | Baseline lint, typecheck và 1 test đạt; emulator-5554 đang kết nối; người dùng xác nhận App đã chạy Android |
| P02 | DONE | Chốt cấu trúc BE/Web/App, bảng contract, role/permission, response/error/pagination và các interface liên nhóm — quyết định ghi tại mục 2.1; field chi tiết DTO chốt dần theo từng task khi dựng Swagger |
| B01 | DONE | NestJS bootstrap, Config, Mongo, validation, requestId, filters, Swagger, /api/v1, health check; có cấu hình mẫu và hướng dẫn chạy. Bằng chứng 10/11/2026: `backend/` build + typecheck sạch, 24/24 test e2e đạt trên MongoDB local (lỗi 401/403/422 đúng định dạng, JWT/permission, idempotency, audit append-only + redact, outbox), chạy thật /health và /api/docs; hướng dẫn trong `backend/README.md`. Chưa gồm endpoint nghiệp vụ (thuộc I01+) |
| B02 | TODO | React Web Admin router/layout/menu, auth và permission guards, form/table/modal cơ bản; đăng nhập và chuyển trang đúng quyền |
| B03 | DOING | Welcome, 5 tab, route types, modal coordinator, auth routes, token storage; back/dismiss đúng, không chồng modal nhập liệu |
| B04 | DOING | Theme/tokens, Button/Input/Card/Text/Toast/Confirm/Loading/Empty/Error, API client typed và error mapper; web/mobile có component phù hợp nền tảng, chung contract và tokens khi khả thi |
| I01 | DOING | 15 auth endpoints theo báo cáo: đăng ký/OTP/email/login/Google/refresh/logout/password/contact/deletion; kiểm kê lại method + path; rate limit, rotation, revocation và tài khoản khóa được kiểm thử. **Backend xong 10/11/2026** (15/15 endpoint, 36 test e2e: OTP hết hạn/quá lượt/tách mục đích, refresh rotation + reuse + song song, reset token dùng một lần, CSRF cho cookie web, rate limit + cooldown, Google qua verifier stub). Đã bổ sung: gửi email thật qua SMTP (`docs/EMAIL_SETUP.md`), lỗi tiếng Việt, tên trường ContactChange đối chiếu với `.docx`. **App U01–U04 xong 10/11/2026** (đăng ký, OTP, đăng nhập, quên mật khẩu, lưu token trong Keychain, khôi phục phiên, đăng xuất; kiểm chứng trên emulator). **Google đăng nhập xong 10/11/2026** (nút "Tiếp tục với Google" ở U03/U01, kiểm chứng với tài khoản Google thật trên emulator). **Còn**: Web ADM-01 + A01–A03; cần bạn: tạo tài khoản SMTP (Brevo) và thử gửi mail thật; SMS chưa tích hợp có chủ đích |
| I02 | TODO | Hồ sơ, public profile theo privacy, đổi liên hệ có xác minh, đổi mật khẩu, privacy, notification settings, devices và yêu cầu xóa tài khoản; UI gọi API thật, dữ liệu lưu bền |
| I03 | TODO | Admin user list/detail, search/filter/pagination, activity/violations, suspend/unsuspend; permission, redaction và audit đầy đủ |
| I04 | TODO | Admin CRUD và permissions full replace; chỉ đúng quyền được thao tác, bảo vệ tài khoản Super Admin cuối cùng và xử lý thao tác đồng thời |
| I05 | TODO | Dashboard và thống kê G1 qua contribution từ các domain; khoảng thời gian và số liệu có kiểm chứng |
| I06 | TODO | Audit append-only writer, redaction, list/detail/filter và before/after; TV2/TV3 tích hợp qua interface |
| I07 | DOING | AuthGate/PermissionGate, guest flow, refresh tối đa một lần cho request, phối hợp refresh đồng thời, expired/locked session và dirty guard; giữ draft và chỉ resume hành động còn hợp lệ. **Đã xong**: SessionManager (refresh một lần, gộp refresh đồng thời, không lặp, kết thúc phiên khi hết hạn/khóa), U57 (modal phiên kết thúc), dirty guard trong form U01–U04. **Còn**: U19 resume hành động sau đăng nhập, PermissionGate |
| INT01 | TODO | Kiểm thử luồng avatar: TV1 form → TV3 upload READY → TV1 profile update |
| INT02 | TODO | Kiểm thử report USER: TV3 quyết định → TV1 user action → audit và notification theo contract |
| INT03 | TODO | Kiểm thử trang Cá nhân mở favorites/suggestions của TV2 và posts/docs/notifications của TV3 |
| INT04 | TODO | Kiểm tra audit và số liệu từ thao tác quản trị TV2/TV3 hiển thị đúng trên màn TV1 |
| REL01 | TODO | Tài liệu cấu hình/chạy, seed phát triển an toàn, kiểm tra build và bộ demo; ghi giới hạn kiểm chứng iOS nếu môi trường Windows không chạy được |

### 5.1. Lộ trình chi tiết theo mốc

#### M1 (tuần 1–2) — Base đủ để TV2/TV3 cắm module

- B03/B04 hoàn tất: commit phần App hiện có; thêm query cache (TanStack Query) và quy ước query-key; `ConfirmDialog`, `Select`, `Checkbox`; `UploadPicker/Progress` UI gọi API TV3 qua interface.
- B01 `backend/`: NestJS + Mongoose, ConfigModule + `.env.example`, prefix `/api/v1`, global ValidationPipe trả 422 với `details[]`, exception filter trả `ApiFailure`, interceptor envelope + `requestId`, Swagger, `/health`, khởi tạo index.
- Common: `JwtAuthGuard`, `@Public`, `@RequirePermission(module, action)`, `@SuperAdmin`, `@CurrentUser` → `IdentityContext`, `IdempotencyInterceptor` (unique `actorId,route,key` + TTL).
- `AuditService` (theo `AuditAction`, redact password/token/OTP) và `OutboxService` (ghi cùng transaction với mutation).
- Schema TV1 theo ERD: users (unique `emailNormalized`, sparse unique `phoneNormalized`, index `status,createdAt`), admin_profiles, sessions (`refreshTokenHash`, `familyId`, TTL `expiresAt`), otp_challenges (`otpHash`, `purpose`, `attemptCount`, TTL), user_devices (`pushTokenHash`), audit_logs, idempotency_keys, outbox_events.
- B02 `web-admin/`: router, AuthLayout/AdminShell (menu theo permission, không Drawer), `PermissionGate`, API client theo contract chung, DataTable/Form/Modal C/L/F, Toast.
- Qua mốc: BE khởi động, 401/422 đúng format; Admin vào được shell; App vẫn build Android; có hướng dẫn TV2/TV3 đăng ký module/route/modal.

#### M2 (tuần 3–4) — I01 Auth + I07 phiên

- BE 15 endpoint `/auth/*`: register → OTP email (hash, hạn 5 phút, tối đa 5 lần, cooldown); login WEB_ADMIN/MOBILE; Google (verify iss/aud/exp/signature); refresh rotation theo `familyId`, phát hiện reuse → thu hồi cả family; logout; me; forgot/verify-otp/reset (ResetGrant); change password; contact change request/confirm; deletion request. Rate limit bằng `@nestjs/throttler`.
- Mail adapter: dev ghi qua adapter an toàn; không log OTP ở môi trường thật.
- App: U01–U04; `SessionStore` + Keychain; refresh tối đa 1 lần/request và gộp các refresh đồng thời; U19 resume hành động sau login; U56 dirty guard với form thật; U57 phiên hết hạn/bị khóa.
- Admin: ADM-01 + A01–A03.
- Test bắt buộc: OTP hết hạn/quá lượt, refresh reuse, tài khoản SUSPENDED bị chặn, 429 kèm Retry-After.

#### M3 (tuần 5–6) — I02 Hồ sơ & cài đặt

- BE 9 endpoint `/users/*`: profile patch (university–major qua `TaxonomyRef` của TV2; `avatarFileId` qua `FileReadyRef` của TV3), privacy, notification-settings, public-profile theo privacy, devices.
- App: USR-35 Cá nhân dùng session thật; U05–U08, U46–U53; lối vào U18/U26 (TV2) và U32/U33/U43/U45 (TV3) qua route registry.
- Khi TV2/TV3 chưa bàn giao: dùng adapter mock ghi rõ; INT01 chỉ DONE khi chạy với upload thật.

#### M4 (tuần 7–8) — I03 Users + I04 Admins

- BE AdminUsers 9 endpoint: list lọc `q, role, status, createdFrom, createdTo, sort`; detail; status SUSPEND/UNSUSPEND kèm thu hồi session và audit; các tab posts/documents/reviews/suggestions gọi query service của TV2/TV3.
- BE AdminAdmins 6 endpoint: tạo lời mời, patch, PUT permissions full replace, DELETE; chặn tự vô hiệu hóa và Super Admin cuối cùng; đổi quyền có hiệu lực ngay với phiên đang mở.
- Admin: ADM-03/04/05, A04–A11. Cung cấp `UserModerationCommand` cho TV3 (A48).

#### M5 (tuần 9–10) — I05 Stats + I06 Audit UI

- Interface `StatsContribution`; TV2/TV3 cung cấp aggregation; endpoint `/admin/dashboard`, `/admin/statistics/activity`, `/admin/statistics/overview`.
- Admin: ADM-02, ADM-24 (biểu đồ, khoảng ngày, granularity), ADM-25 + A50/A51 (before/after đã redact).

#### M6 (tuần 11–12) — Tích hợp & bàn giao

- INT01–INT04 với triển khai thật của TV2/TV3.
- REL01: seed dev an toàn (1 SUPER_ADMIN, vài USER), README chạy BE/Web/App, checklist demo, ghi giới hạn iOS trên Windows.

Kiểm tra mỗi mốc: App `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`; backend unit + e2e (supertest + mongodb-memory-server); build web-admin; smoke Android theo `MOBILE_BASE_VERIFICATION.md`.

## 6. Chi tiết phần nền tảng cần làm trước

- [ ] Giữ App ở gốc; tạo `src/app`, `src/navigation`, `src/shared`, `src/features` theo trách nhiệm.
- [ ] Tách feature `welcome`, `auth`, `profile`; cung cấp điểm đăng ký tab/route cho TV2/TV3.
- [ ] Năm tab: Trang chủ, Khám phá, Cộng đồng, Tài liệu, Cá nhân. Giao diện chờ module chưa có phải thể hiện đúng trạng thái, không giả dữ liệu như đã tích hợp.
- [ ] Welcome có tiếp tục với khách, đăng nhập, đăng ký; xử lý từ chối quyền thông báo/vị trí mà không chặn xem nội dung công khai.
- [ ] Định nghĩa modal C/L/F và cơ chế chuyển bước; back button, keyboard, safe area và form dài hoạt động đúng.
- [ ] Component có trạng thái disabled/loading/error và nhãn accessibility phù hợp.
- [ ] API client xử lý envelope, lỗi field, requestId, 204, network timeout và hủy request.
- [ ] Định nghĩa session store và interface lưu token; refresh mobile dùng vùng lưu trữ an toàn. Web refresh theo cookie/CSRF contract.
- [ ] Backend/Web Admin đặt trong thư mục riêng khi triển khai; tách script, TypeScript, lint và test để không bị cấu hình React Native quét nhầm.
- [ ] Tạo interface auth/permission/audit/stats trước khi TV2/TV3 cần tích hợp.

Không chuyển framework hoặc nâng/hạ phiên bản nền tảng chỉ để dựng base. Nếu cần sửa tương thích, ghi lỗi thực tế và quyết định vào nhật ký.

## 7. Database và contract TV1

Schema dự kiến cần chốt: `users`, `admin_profiles`, `sessions`, `otp_challenges`, `user_devices`, `audit_logs`. `idempotency_keys` là phần dùng chung cần thống nhất owner; không tự lấy quyền sở hữu các collection domain khác.

- API trả `id:string`, ngày giờ ISO 8601; MongoDB lưu ObjectId/Date theo schema đã chốt.
- Email/phone chuẩn hóa và index uniqueness phải phù hợp quy tắc optional/soft delete.
- Password, OTP và refresh token không lưu dạng rõ; có hạn dùng, giới hạn thử, thu hồi và chống dùng lại phù hợp từng loại.
- Trạng thái users, admin_profiles và quyền phải có nguồn sự thật xác định; việc đổi quyền/khóa tài khoản phải ảnh hưởng đến phiên đang hoạt động theo contract.
- TTL index không thay thế kiểm tra hết hạn tại thời điểm xử lý request.
- Audit không được ghi password, token, OTP hoặc dữ liệu cá nhân ngoài phạm vi cần thiết.
- Avatar cần kiểm tra file READY, đúng owner, đúng purpose AVATAR thông qua interface của TV3.
- API mutation lấy actor từ ngữ cảnh xác thực, không tin userId do client gửi.
- Lập bảng method/path, DTO, quyền, response, lỗi, UI mapping và test cho toàn bộ API TV1; đối chiếu con số 44 của báo cáo, ghi rõ mọi sai lệch.

## 8. Phụ thuộc và bàn giao giữa các thành viên

| Bên cung cấp → bên dùng | Nội dung | Thời điểm cần |
| --- | --- | --- |
| TV1 → TV2/TV3 | IdentityContext, public author, guards, error/response contract, API client | M1/M2 |
| TV1 → TV2/TV3 | AuditAction writer, route/modal registration, shared UI và query-key conventions | M1/M2 |
| TV2 → TV1 | Universities/majors/subjects; provinces/wards; quy tắc trường-ngành | Trước khi nghiệm thu I02 |
| TV3 → TV1 | Upload/init/complete/status/access; FileReadyRef và quyền truy cập | Trước khi nghiệm thu avatar I02 |
| TV1 → TV3 | User moderation command, permissions, settings và device interface | Trước khi nghiệm thu report USER/push |
| TV2/TV3 → TV1 | StatsContribution, activity/violations summary và navigation targets | Trước khi nghiệm thu I03/I05/INT03 |
| TV1/TV2 → TV3 | NotificationEvent theo schema chung | Trước nghiệm thu các workflow có thông báo |

Khi phụ thuộc chưa có, có thể dùng adapter/mock rõ ràng để phát triển giao diện và kiểm thử contract. Task tích hợp chỉ DONE sau khi chạy với triển khai thật của bên cung cấp. Ghi phần chờ cụ thể, tiếp tục phần độc lập.

## 9. Điều kiện hoàn thành chung

Một task chức năng chỉ DONE khi đạt các mục áp dụng cho task đó:

1. Contract, quyền và validation khớp hành vi triển khai.
2. Backend và dữ liệu thực hoạt động; giao diện gọi API thật.
3. Loading/empty/error/success và các lỗi 401/403/409/422 liên quan được xử lý; draft không mất ngoài ý muốn.
4. Cache và UI cập nhật sau mutation, không gửi lặp thao tác vì nhấn nhiều lần.
5. Kiểm thử tập trung vào rủi ro thật: quyền, ownership, OTP/refresh, tranh chấp cập nhật, audit/redaction và tích hợp liên module.
6. Chạy lint/typecheck/test/build phù hợp phần thay đổi; ghi kết quả và môi trường. Không yêu cầu viết test hình thức cho mọi chỉnh sửa giao diện nhỏ.
7. Cập nhật hướng dẫn chạy, contract và nhật ký khi có thay đổi tương ứng.

Các lỗi môi trường hoặc phụ thuộc chưa có phải được ghi riêng; không ghi DONE nếu chúng ngăn xác nhận tiêu chí bắt buộc.

## 10. Công việc tiếp theo

Thực hiện tuần tự, cập nhật mục này sau mỗi đợt:

1. Commit phần base App hiện có (B03/B04) sau khi chạy lại lint/typecheck/test.
2. Loại trừ `backend/` và `web-admin/` khỏi `tsconfig.json`, `.eslintrc.js`, `jest.config.js`, `metro.config.js` của App.
3. B01: hoàn tất (xem nhật ký).
4. B02: dựng `web-admin/` shell + PermissionGate (React + Vite, tách package, đã loại khỏi cấu hình App).
5. Bổ sung query cache và các primitive còn thiếu cho App; sau đó vào M2 (I01/I07).

## 11. Nhật ký tiến độ và quyết định

| Ngày | Task | Việc đã làm | Bằng chứng/giới hạn | Bước tiếp theo |
| --- | --- | --- | --- | --- |
| 10/11/2026 | Khảo sát | Đọc ba tài liệu, kiểm tra repo React Native CLI và App mẫu | Đã đọc package/App; chưa chạy build hoặc kiểm thử | P00 |
| 10/11/2026 | P00 | Tạo kế hoạch này và AGENTS.md để các lần triển khai đọc và cập nhật | Chỉ thay đổi tài liệu; chưa triển khai nghiệp vụ | P01 |
| 10/11/2026 | P02 | Đối chiếu ERD dbdiagram + báo cáo PDF; chốt quyết định mục 2.1, thêm lộ trình mục 5.1 M1–M6 | Chỉ thay đổi tài liệu; chưa có code backend/web-admin | Commit base App, rồi B01 |
| 10/11/2026 | B01 | Dựng `backend/` (NestJS 11, Mongoose 9, TS 5.9, Vitest), schema ERD, guards, idempotency, audit, outbox, tests e2e | `tsc`/build sạch; 24/24 test đạt trên MongoDB local; smoke chạy thật /health, 404 đúng envelope, /api/docs 200; App lint/typecheck/11 test vẫn đạt. Lỗi đã sửa: APP_CONFIG không inject được vào IdentityModule (nay có ConfigModule toàn cục); `@Prop` kiểu union/ObjectId phải khai báo `type` rõ. Quyết định: Nest 11 vì Nest 12 chỉ ESM nên Jest không nạp được; Vitest thay Jest vì driver MongoDB 7 lỗi handshake trong vm sandbox của Jest (mongodb-memory-server cũng bị) | Commit, rồi B02 (web-admin) |
| 10/11/2026 | I01 (backend) | 15 endpoint `/auth/*`: register/verify/resend, login (MOBILE + WEB_ADMIN cookie), Google, refresh rotation + reuse detection, logout, me, forgot/verify/reset, change password, contact change, deletion request. Access token mang `sid` (phiên) nên logout/khóa/đổi mật khẩu có hiệu lực ngay | `tsc` sạch; 60/60 test e2e đạt (36 test auth); chạy thật trên server build: đăng ký → OTP → verify → /auth/me. Giả định cần xác nhận: tên trường ContactChangeRequest/Challenge (`channel`,`value`,`destination`,`resendAvailableAt`) vì PDF cắt chữ; thông báo lỗi mặc định của class-validator đang là tiếng Anh. Chưa có: gửi mail/SMS thật, thử Google thật | App U01–U04 + SessionStore/AuthGate (I07), Web ADM-01 |
| 10/11/2026 | I01 (sửa) | Gửi email thật qua SMTP (nodemailer) + `mail:test`; production bắt buộc SMTP; SMS trả 503 `SMS_NOT_CONFIGURED`; thông báo lỗi tiếng Việt (validation + lỗi framework); backend tự đọc `.env`; sửa tên trường theo `.docx` gốc: `newValue`, `deliveryChannel`, `maskedDestination` (trước đó đoán sai từ PDF cắt chữ) | `tsc` sạch; 69/69 test e2e đạt (thêm test SMTP bằng jsonTransport, lỗi gửi mail, SMS, cấu hình production, i18n); chạy thật: backend tự nạp `.env`, 401 tiếng Việt. **Chưa kiểm chứng**: gửi mail tới hộp thư thật và Google với client id thật (cần tài khoản của người dùng). Lưu ý spec: `AuthRegister.phone` ghi ✓ (bắt buộc) trong bảng nhưng ghi chú, U01 và User đều coi là tùy chọn; đang để tùy chọn, cần xác nhận | Người dùng cấu hình SMTP + Google rồi thử; App U01–U04 |
| 10/11/2026 | I01/I07 (App) | `SessionManager` + Keychain + `AuthProvider`; form U01–U04 trong một `AuthModal`; U57; Cá nhân và Cài đặt hiện tài khoản/đăng xuất; bỏ `AuthEntry` mẫu | `tsc`, lint sạch; 14 test SessionManager + 16 test UI đạt (App tổng 40/40). Chạy thật trên emulator với backend + MongoDB: đăng ký → OTP → đăng nhập chưa xác minh → xác minh → tab Cá nhân → tắt/mở lại app vẫn đăng nhập → đăng xuất; DB: phiên xoay vòng/thu hồi đúng, token lưu dạng băm. Lỗi gặp khi test thủ công không phải của app: Gboard hiện thanh viết tay, `adb input text` làm rơi ký tự ở bản debug. Chưa làm: Google (cần OAuth client), U19 resume | U05–U08 hồ sơ (I02), hoặc Web Admin B02/ADM-01 |
| 10/11/2026 | I01 (Google) | Nút "Tiếp tục với Google" (`GoogleSignInButton`, form đăng nhập + đăng ký) dùng `@react-native-google-signin/google-signin`, gửi idToken tới `POST /auth/google`; Web client id trong `src/shared/config.ts` và `GOOGLE_CLIENT_IDS` của backend; keystore debug riêng cho dự án (SHA-1 trong `docs/GOOGLE_SIGNIN_SETUP.md`) + client Android `com.studyspace` | App 45/45 test đạt (thêm 5 test Google: thành công, đóng hộp chọn, tài khoản khóa, lỗi Google, có ở form đăng ký), lint + tsc sạch, `assembleDebug` thành công. Chạy thật trên emulator + backend + MongoDB: đăng nhập bằng tài khoản Google thật → vào app, tên hiển thị lấy từ Google; DB: 1 user `authProviders:[GOOGLE]`, `emailVerified:true`, không có `passwordHash`, 1 phiên MOBILE với refresh token lưu dạng băm 64 ký tự. Đăng xuất rồi đăng nhập Google lần hai: vẫn đúng 1 user (cùng `_id`, `lastLoginAt` cập nhật), phiên cũ `revoked`, phiên mới hoạt động. Giới hạn: chưa thử liên kết Google với tài khoản mật khẩu có sẵn bằng Google thật (đã có test backend); emulator hết dung lượng nên build debug chỉ cho `x86_64` (`-PreactNativeArchitectures=x86_64`) | Web ADM-01/B02 hoặc I02 hồ sơ |

Mỗi lần cập nhật cần ghi: task đang làm, file/phần chức năng đã thay đổi, kiểm tra đã chạy và kết quả, phụ thuộc còn chờ, bước tiếp theo. Nếu thay đổi phạm vi hoặc quyết định thiết kế, bổ sung lý do và task bị ảnh hưởng.
