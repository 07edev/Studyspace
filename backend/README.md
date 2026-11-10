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
- Chưa có endpoint auth (I01), users (I02), admin (I03/I04), stats (I05), audit API (I06).
