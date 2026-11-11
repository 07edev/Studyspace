# StudySpace Backend

NestJS 11 + MongoDB (Mongoose 9). API prefix `/api/v1`, Swagger at `/api/docs` (not in production).

## Chạy

1. Cần MongoDB đang chạy (local `mongodb://127.0.0.1:27017` hoặc Atlas).
2. `cp .env.example .env`, điền `JWT_ACCESS_SECRET` (>= 32 ký tự) và `MONGODB_URI`.
   Sinh secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. `npm install`
4. `npm run start:dev` (hoặc `npm run build && npm start`)
5. Kiểm tra: `GET http://localhost:3000/api/v1/health`

Thiếu hoặc yếu secret/URI thì server từ chối khởi động.

## Test

`npm test` chạy Vitest và dùng MongoDB local; mỗi lần chạy tạo database tạm `studyspace_test_*` rồi xóa.
Đổi máy chủ test bằng biến `TEST_MONGODB_URI` (chỉ phần host, ví dụ `mongodb://127.0.0.1:27017`).

Dùng Vitest thay vì Jest vì driver MongoDB 7 lỗi handshake trong vm sandbox của Jest
(`Missing required sub-document 'driver'`). `@swc` giữ `emitDecoratorMetadata` cho NestJS DI.
Khi khai báo `@Prop` với kiểu union hoặc ObjectId, luôn ghi rõ `type:` (`String`, `MongooseSchema.Types.ObjectId`).

## Dùng chung cho TV2/TV3

| Cần | Dùng |
| --- | --- |
| Bỏ qua xác thực | `@Public()` |
| Public nhưng nhận diện nếu có token | `@OptionalAuth()` |
| Kiểm quyền admin | `@RequirePermission('PLACES', 'UPDATE')` |
| Chỉ Super Admin | `@SuperAdminOnly()` |
| Lấy actor | `@CurrentUser()` (không bao giờ đọc userId từ body) |
| Chống gửi lặp | `@Idempotent()` (client gửi header `Idempotency-Key`) |
| Ghi nhật ký quản trị | `AuditService.record({...})` (tự che password/token/otp) |
| Phát sự kiện sau commit | `OutboxService.enqueue({...})`; TV3 đăng ký `subscribe(eventType, handler)` |
| Lỗi nghiệp vụ | `throw new ApiException(status, 'CODE', 'message', details?)` |

Đăng ký module mới ở `src/app.module.ts` (mục `imports`). Mọi guard chạy toàn cục theo thứ tự
throttle → xác thực → phân quyền. Danh tính được nạp lại từ DB mỗi request nên khóa tài khoản
hoặc đổi quyền có hiệu lực ngay.

## Lưu ý

- `npm test` đôi khi báo "Worker exited unexpectedly with exit code 3221226505" (khoảng 1/8 lần chạy trên Windows/Node 24, cả với file test cũ, kể cả khi đổi sang `--pool=threads`). Đây là sập tiến trình native, không phải test sai: chạy lại là qua.

- `idempotency_keys` có thêm `requestHash`, `state`, `response` so với ERD để phát lại kết quả an toàn.
- Collection TV1: users, admin_profiles, sessions, otp_challenges, user_devices, audit_logs,
  idempotency_keys, outbox_events (xem `docs/ARCHITECTURE.md`).
- Đã có: 15 endpoint `/auth/*` (I01) và 9 endpoint `/users/*` (I02). Chưa có: admin (I03/I04), stats (I05), audit API (I06).

## Auth (I01)

- Access token JWT 15 phút mang `sid` (phiên); mỗi request kiểm phiên còn hiệu lực nên logout, khóa tài khoản,
  đổi/đặt lại mật khẩu có hiệu lực ngay. Refresh token là chuỗi ngẫu nhiên, chỉ lưu sha256, xoay vòng mỗi lần dùng;
  dùng lại token cũ sẽ thu hồi cả phiên (`TOKEN_REUSED`).
- MOBILE nhận `refreshToken` trong body. WEB_ADMIN nhận cookie `ss_refresh` (HttpOnly, SameSite=Strict, path `/api/v1/auth`);
  refresh bằng cookie bắt buộc header `X-Requested-With: XMLHttpRequest`.
- `POST /auth/login` và `GET /auth/me` trả thêm `user.admin { status, permissions }` cho ADMIN/SUPER_ADMIN (Web Admin dùng để vẽ menu; server vẫn kiểm quyền ở mọi API).
- Super Admin đầu tiên (chỉ dev): `SEED_ADMIN_PASSWORD='...' npm run seed:admin` (bỏ biến để tự sinh mật khẩu, in một lần; chạy lại không tạo thêm tài khoản; `-- --reset-password` để đặt lại; từ chối khi `NODE_ENV=production`).
- OTP: 6 số, HMAC theo secret, hết hạn 5 phút, tối đa 5 lần thử, cooldown 60 giây (429 + `Retry-After`).
- Mật khẩu: scrypt; 10-72 ký tự, có chữ hoa, chữ thường, chữ số.
- Email: gửi OTP qua SMTP khi có `SMTP_HOST` (bắt buộc ở production, thiếu thì không khởi động). Không có SMTP (chỉ dev)
  thì OTP in ra log. Chọn nhà cung cấp và cấu hình: `docs/EMAIL_SETUP.md`. Thử nhanh: `npm run mail:test -- <email>`.
- SMS: chưa tích hợp có chủ đích; đổi số điện thoại trả `503 SMS_NOT_CONFIGURED`.
- Google: đặt `GOOGLE_CLIENT_IDS` (hướng dẫn tạo OAuth client: `docs/GOOGLE_SIGNIN_SETUP.md`); token được xác minh
  chữ ký/iss/aud/exp qua `google-auth-library`.
- Backend tự đọc `backend/.env` khi chạy (`npm run start:dev` hoặc `npm start`).
- Thông báo lỗi trả về bằng tiếng Việt; client dựa vào `error.code` và `details[].field`, không dựa vào chữ.
- Rate limit theo IP trên từng endpoint auth; đặt `RATE_LIMIT_DISABLED=true` để tắt khi dev (bị bỏ qua ở production).

## Quản trị người dùng và Admin (I03/I04)

- `/admin/users/*` (quyền `USERS.READ`; đổi trạng thái cần `USERS.UPDATE`): danh sách có lọc (`q`, `role`, `status`, `createdFrom`, `createdTo`, `sort`, `page`, `limit` ≤ 100), chi tiết, `PATCH …/status`
  (`{action: SUSPEND|UNSUSPEND, reason ≥ 10 ký tự}`), `activity` (việc người đó làm), `violations` (các lần xử lý). Dữ liệu trả về đã che bớt (không ngày sinh, giới thiệu, vị trí; số điện thoại che giữa).
  Không thể khóa chính mình hoặc Super Admin; tài khoản Admin chỉ Super Admin khóa được. Khóa thu hồi mọi phiên, ghi audit `USER_SUSPENDED/USER_UNSUSPENDED` (có lý do) và sự kiện outbox `USER_STATUS_CHANGED` (không có lý do) cho TV3 gửi thông báo.
- Nội dung của người dùng (`posts`, `documents`, `reviews`, `suggestions`) và số đếm trong `UserAdminDetail`: **TV2/TV3 nối** bằng cách kế thừa `NotConnectedUserContentRef` (`modules/admin-users/ports.ts`) và đổi `useClass` trong `admin-users.module.ts`.
  Chưa nối thì số đếm bị bỏ khỏi phản hồi (không phải 0) và endpoint trả 503 `CONTENT_NOT_CONNECTED`. TV3 ghi audit cho quyết định báo cáo về người dùng thì thêm tên hành động vào `USER_MODERATION_ACTIONS` để hiện ở "lịch sử xử lý".
- `/admin/admins/*` (chỉ Super Admin): `POST` tạo quản trị viên **không có mật khẩu** và gửi email mời (không chứa mật khẩu/mã); người được mời vào trang quản trị → "Quên mật khẩu" để đặt mật khẩu đầu tiên. Phản hồi có `invitationSent` (false nếu gửi mail lỗi; tài khoản vẫn được tạo).
  `PUT …/permissions` thay toàn bộ danh sách; `INVALID_PERMISSION` cho module/thao tác không tồn tại, trùng, rỗng hoặc module `ADMINS` (chỉ Super Admin). `PATCH` đổi tên/trạng thái; `DELETE` gỡ quyền quản trị (tài khoản còn lại là người dùng thường).
  Quyền có hiệu lực ngay vì server đọc quyền ở mỗi request; vô hiệu hóa/gỡ quyền thu hồi phiên. Không ai tự vô hiệu hóa hoặc gỡ chính mình, nên Super Admin cuối cùng luôn còn; mọi thay đổi lên Admin chạy tuần tự trong tiến trình (`common/utils/mutex.ts`) — chạy nhiều instance cần khóa ở database.
- Phân trang dùng chung: `common/utils/page.ts` (`PageQuery`, `toPage`, `escapeRegex`).

## Nhật ký và thống kê (I06/I05)

- `GET /admin/audit-logs`, `GET /admin/audit-logs/{id}` (quyền `AUDIT.READ`): chỉ đọc. Lọc `actorId`, `actorType`, `action` (chứa chuỗi, không phân biệt hoa thường, không phải mẫu), `resourceType`, `resourceId`, `requestId`, `from`, `to`; mới nhất trước.
  Mỗi dòng kèm `actor {displayName, email}` khi người thực hiện là một tài khoản. Giá trị lưu dưới khóa nhạy cảm (password, token, otp…) đã bị che từ lúc `AuditService.record`. **TV2/TV3 ghi audit chỉ qua `AuditService.record`**, không ghi thẳng `audit_logs`.
- `GET /admin/dashboard`, `/admin/statistics/overview`, `/admin/statistics/activity` (quyền `STATISTICS.READ`): ngày theo giờ Việt Nam (UTC+7), `from/to` là ngày gồm cả hai đầu, tối đa 366 ngày. "Người dùng" = tài khoản role USER chưa bị xóa.
  Chuỗi theo ngày được điền 0; `granularity` WEEK lấy thứ Hai làm ngày đầu tuần, MONTH lấy ngày 1.
- **Số liệu của TV2/TV3** đăng ký qua `StatsRegistry` (global), thường trong `onModuleInit` của module của bạn:

```ts
constructor(private readonly stats: StatsRegistry) {}
onModuleInit() {
  this.stats.register({
    name: 'places',
    // Tổng và hàng chờ hiện tại. Trường hợp lệ: totalPlaces, pendingSuggestions, totalPosts, totalDocuments,
    // pendingDocuments, openReports (số nguyên >= 0) và placesByCategory ({ tên: số }).
    overview: async window => ({ totalPlaces: await this.places.count(), pendingSuggestions: await this.sugg.countPending() }),
    // Số mục MỚI mỗi ngày trong window (date = YYYY-MM-DD giờ Việt Nam; ngày vắng mặt tính là 0).
    daily: async window => ({ places: await this.places.createdPerDay(window) }),   // chuỗi: places | posts | documents | reports
  });
}
```

  Chưa đăng ký thì trường/chuỗi đó **vắng mặt** trong phản hồi (Web hiện "—", không phải 0). Giá trị sai (âm, không nguyên, trường lạ) bị bỏ; nguồn ném lỗi bị bỏ qua và nêu trong `failedSources`.
  `window = { from, to }` là khoảng nửa mở `[from, to)` theo `Date`. Sau thao tác kiểm duyệt phía Web, gọi `queryClient.invalidateQueries({ queryKey: queryKeys.stats.all })` để dashboard làm mới.

## Users (I02)

- `GET /users/me`, `PATCH /users/me/profile` (chỉ gửi trường đổi; `null` hoặc chuỗi rỗng xóa trường tùy chọn; `displayName` không xóa được),
  `GET|PATCH /users/me/privacy`, `GET|PATCH /users/me/notification-settings` (PATCH nhận một phần các trường),
  `GET /users/{id}/public-profile` (công khai; chỉ tài khoản ACTIVE; hồ sơ PRIVATE chỉ trả `id`, `displayName`, `avatarUrl`),
  `POST /users/me/devices` (trả `{message, deviceId}`), `DELETE /users/me/devices/{deviceId}` (204).
- **TV2/TV3 cần nối hai cổng** trong `src/modules/users/ports.ts` (đổi `useClass` ở `users.module.ts`):
  `TaxonomyRef.assertValid` (trường/ngành/môn tồn tại, ngành thuộc trường; lỗi `UNIVERSITY_MAJOR_MISMATCH` 422) và
  `FileReadyRef.assertReady` (tệp READY, đúng mục đích avatar, thuộc người dùng; lỗi `FILE_NOT_READY` 409).
  Khi chưa nối, sửa trường/ngành/môn hoặc `avatarFileId` trả 503 (`TAXONOMY_NOT_CONNECTED`, `FILE_SERVICE_NOT_CONNECTED`) thay vì tin id chưa kiểm tra.
- `user_devices` lưu `pushTokenHash` (tra cứu/duy nhất) và thêm `pushToken` (`select: false`, không bao giờ trả ra API) vì gửi push cần token thật.
  Một token chỉ thuộc tài khoản đăng ký sau cùng; mỗi người tối đa 10 thiết bị (xóa cái cũ nhất).
