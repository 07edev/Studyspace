# Nền tảng triển khai StudySpace

Cập nhật 10/11/2026. Các quyết định trong file này áp dụng cho base App đang triển khai. Backend, Web Admin và contract nghiệp vụ vẫn cần được hoàn thiện theo kế hoạch TV1.

## Cấu trúc hiện tại

```text
App.tsx                         Điểm vào, chuyển đến StudySpaceApp
src/app/                        Providers và vòng đời ứng dụng
src/navigation/                 5 tab, route types, modal coordinator/host
src/features/welcome/           Welcome và minh họa SVG
src/features/home/              Giao diện shell Trang chủ, TV2 thay bằng luồng thật
src/features/profile/           Cá nhân trong chế độ Khách, các lối vào nghiệp vụ
src/features/auth/              Điểm vào auth, chưa có phiên đăng nhập
src/features/pending/           Trạng thái chờ TV2/TV3 và metadata feature
src/shared/theme/               Màu sắc, spacing, radius
src/shared/ui/                  Text, Button, Input, Card, Screen, states, Toast
src/shared/contracts/           Envelope, phân trang và interface liên nhóm
src/shared/api/                 API client, ApiError, mapping lỗi field
docs/                           Kế hoạch, API checklist, hướng dẫn tích hợp
```

Giữ React Native CLI ở gốc để giữ Android/iOS và lệnh chạy hiện tại. Khi dựng Backend/Web Admin, đặt trong `backend/` và `web-admin/`, với package/scripts riêng. Trước khi thêm các thư mục đó phải tách include/exclude TypeScript, ESLint, Jest và Metro phù hợp để tránh quét nhầm mã server/web vào App.

## Điều hướng và modal

- React Navigation 7 dùng 5 bottom tabs: Home, Explore, Community, Documents, Profile. Tên và params được khai báo trong `navigation/types.ts`.
- `AppTabs.tsx` là nơi đăng ký component màn hình; logic domain nằm trong feature của owner.
- Welcome chuyển sang chế độ Khách bằng state local. State này không đại diện cho đăng nhập và chưa được lưu bền qua lần khởi động.
- Chỉ `ModalHost` tạo native Modal. Mở route mới thay route hiện tại, không tạo thêm lớp native Modal.
- Kích thước C: hộp xác nhận; L: sheet; F: toàn màn hình. Màn dài có ScrollView và KeyboardAvoidingView.
- Mỗi form gọi `setDirty(true/false)` khi dữ liệu thay đổi/lưu xong. Đóng hoặc chuyển route khi dirty sẽ xin quyết định; giữ form mounted trong khi hỏi để bảo toàn draft. Nút Back khi đang hỏi sẽ giữ form.
- Dirty guard mới được kiểm thử ở reducer; cần kiểm thử tiếp với form nghiệp vụ thật tại I07.
- Phiên đăng nhập do `shared/auth/sessionManager.ts` quản lý (xem mục "Phiên đăng nhập"). `auth-required` vẫn là điểm chặn giao diện cho Khách; chưa có resume hành động sau đăng nhập (U19) hay PermissionGate đầy đủ. Server luôn là nơi kiểm tra quyền.
- Android dùng cấu hình khôi phục fragment và Back theo [hướng dẫn React Navigation](https://reactnavigation.org/docs/getting-started/).

## UI và tích hợp TV2/TV3

- Theme tạm chọn nền sáng, xanh lá trầm và điểm nhấn xanh nhạt. Tokens tập trung trong `shared/theme/tokens.ts`; chưa có chế độ tối.
- `shared/ui` dùng export công khai. Button có loading/disabled và accessibility; TextField có label/error; Screen hỗ trợ safe area và cuộn.
- Feature chưa có hiển thị trạng thái đang hoàn thiện. Không tạo địa điểm, bài viết, số liệu hoặc phiên đăng nhập giả.
- Khi TV2/TV3 bàn giao màn thật: thay component tương ứng ở `AppTabs.tsx`; bổ sung route có params cụ thể trong `types.ts` và renderer ở `ModalHost.tsx` nếu cần modal.
- Các lối vào riêng tư từ Cá nhân hiện mở yêu cầu đăng nhập. Tại I01/I07, thay bằng guard theo session và quyền, kèm intended action được kiểm tra lại trước khi resume.
- Khi tích hợp xong domain, bỏ trạng thái pending tương ứng. Không chuyển quyền sở hữu nghiệp vụ sang TV1 chỉ vì TV1 đã tạo shell.

## API client và contract

Danh sách đầy đủ 44 operations: [TV1_API_CHECKLIST.md](TV1_API_CHECKLIST.md). Đây là bản kiểm kê theo báo cáo, chưa phải 44 API đang chạy.

`createApiClient({baseUrl})` yêu cầu URL do lớp cấu hình cung cấp (`src/shared/config.ts`); `SessionManager` khởi tạo client thật khi App chạy. HTTPS dùng cho môi trường triển khai; địa chỉ HTTP nội bộ chỉ dùng khi phát triển.

- Response thành công có `success`, `data`, `requestId`; lỗi có code/message/details/requestId. 204 không parse body.
- Access token và Idempotency-Key được truyền rõ ràng theo request; client không có secret hardcode.
- Có timeout, hủy request, phân biệt lỗi mạng/hủy/quá hạn, giữ HTTP status/requestId/field errors/cooldown.
- Không tự retry mutation, trừ trường hợp 401 do access token hết hạn: `SessionManager` refresh đúng một lần rồi gửi lại đúng một lần (xem bên dưới). Chưa có query cache.
- Kiểu generic của response không thay thế validation schema runtime cho từng DTO khi tích hợp.
- Interface IdentityContext, PublicAuthor, AuditAction, StatsContribution là đề xuất từ báo cáo; cần chốt trường cụ thể trước khi các domain dùng thật.

## Phiên đăng nhập (App)

- `SessionManager` (UI-agnostic, có test) giữ access token trong bộ nhớ; refresh token nằm trong Keychain/Keystore (`react-native-keychain`, `tokenStorage.ts`), không bao giờ ở AsyncStorage.
- Mở app: `restore()` đọc refresh token, xoay vòng token rồi gọi `/auth/me`. Mất mạng thì giữ token để lần sau thử lại; server từ chối thì xóa token và ghi lý do (`expired`/`suspended`) để hiện U57.
- Request cần đăng nhập đi qua `session.request()`: gặp 401 thì refresh tối đa một lần và gửi lại tối đa một lần (không lặp vô hạn). Nhiều request cùng lỗi 401 dùng chung MỘT lần refresh, vì server xoay vòng token và dùng lại token cũ bị coi là bị đánh cắp.
- `ACCOUNT_SUSPENDED` kết thúc phiên ngay. Đăng xuất luôn xóa phiên cục bộ dù server không phản hồi.
- `AuthProvider` + `useSession()` đưa trạng thái (`restoring | guest | authenticated`) cho giao diện. Đăng xuất chủ động đưa về Welcome; phiên hết hạn/bị khóa giữ người dùng ở chế độ Khách kèm giải thích.
- U01–U04 là một modal toàn màn hình duy nhất chuyển bước (`AuthModal`): đăng nhập, đăng ký, xác minh OTP, quên mật khẩu; có dirty guard và chống bấm đôi (`features/auth/formHooks.ts`).
- Chưa có: nút Google ở U03 (cần OAuth client, xem `docs/GOOGLE_SIGNIN_SETUP.md`).

## Quyền và schema dự kiến cho Backend

| Chủ thể | Ràng buộc |
| --- | --- |
| Khách | Chỉ public read; không có role Guest trong users |
| USER | Tài khoản hợp lệ, scope cá nhân và ownership ở từng mutation |
| ADMIN | User và admin profile phải hợp lệ; kiểm module/action cụ thể |
| SUPER_ADMIN | Quản lý Admin/quyền; vẫn kiểm trạng thái và bảo vệ Super Admin cuối cùng |

Đã chốt theo ERD (P02): `users` giữ identity/role/account status; `admin_profiles` tham chiếu unique userId, giữ admin status (ACTIVE/DISABLED) và permissions `[{module, actions[]}]`. Không tạo collection `admins` riêng. Quyết định phải được phản ánh vào schema và OpenAPI lúc dựng B01/I04.

Collection do TV1 sở hữu (field theo ERD dbdiagram):

| Collection | Field chính | Index/ràng buộc |
| --- | --- | --- |
| users | emailNormalized, phoneNormalized, passwordHash, role, status, emailVerified, authProviders, profile, privacy, notificationSettings, lastLoginAt, deletedAt | unique emailNormalized; sparse unique phoneNormalized; status+createdAt |
| admin_profiles | userId, status, permissions | unique userId |
| sessions | userId, refreshTokenHash, familyId, client, revokedAt, expiresAt | userId; unique refreshTokenHash; TTL expiresAt |
| otp_challenges | userId, emailNormalized, purpose, otpHash, attemptCount, expiresAt, consumedAt | TTL expiresAt; consume atomically |
| user_devices | userId, platform, pushTokenHash, lastSeenAt | userId |
| audit_logs | actorId, actorType, action, resourceType, resourceId, before, after, requestId | actorId/resourceType/resourceId/createdAt; append-only, redacted |
| idempotency_keys | actorId, route, key, responseHash, expiresAt | unique (actorId, route, key) + TTL |
| outbox_events | eventType, aggregateType, aggregateId, payload, status, attempts, nextAttemptAt | status+nextAttemptAt; TV3 sở hữu subscriber notification |

Không lưu password/OTP/refresh token dạng rõ. Mobile token storage sẽ dùng Keychain/Keystore tại I01; hiện chưa lưu token ở bất kỳ nơi nào. UI không thể thay thế kiểm tra quyền ở Backend.

## Những phần còn thiếu của base

- Backend NestJS/MongoDB và Web Admin.
- OpenAPI chi tiết, DTO/validation nghiệp vụ, persistence/schema, email/Google credentials.
- Secure token storage, refresh/session, AuthGate/PermissionGate thật.
- Yêu cầu quyền vị trí/thông báo theo luồng chức năng; hiện không yêu cầu nên từ chối quyền không chặn chế độ Khách.
- Query cache, UploadPicker/FilePicker/Progress và các UI dùng chung bổ sung theo nhu cầu domain.
- Kiểm chứng iOS trên macOS và form thật có bàn phím/dirty state.
