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
