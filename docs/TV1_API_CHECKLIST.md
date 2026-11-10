# Danh sách API TV1

Đối chiếu 44 operations từ mục 7.1 của báo cáo phân công ngày 08/11/2026. Chưa triển khai Backend; tất cả ở trạng thái TODO. Các tên DTO, scope và lỗi bên dưới được giữ theo báo cáo, chưa thay thế OpenAPI/schema cần chốt trước khi code.

Base path dự kiến: `/api/v1`. Mã 204 không có response body. Auth/scope phải được kiểm tra ở server.

| Trạng thái | Method và path | Scope | Request → response data | HTTP | Lỗi | UI |
| --- | --- | --- | --- | --- | --- | --- |
| TODO | `POST /auth/register` | `PUBLIC` | `AuthRegister → AuthRegisterResult` | `201` | `VALIDATION_ERROR, EMAIL_ALREADY_EXISTS, PHONE_ALREADY_EXISTS, RATE_LIMITED` | `U01` |
| TODO | `POST /auth/email/verify` | `PUBLIC` | `OtpVerify → AuthSession` | `200` | `OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED` | `U02` |
| TODO | `POST /auth/email/resend-otp` | `PUBLIC` | `OtpRequest → StatusMessage` | `202` | `RATE_LIMITED, OTP_COOLDOWN` | `A02,U02` |
| TODO | `POST /auth/login` | `PUBLIC` | `AuthLogin → AuthSession` | `200` | `INVALID_CREDENTIALS, ACCOUNT_SUSPENDED, EMAIL_NOT_VERIFIED, RATE_LIMITED` | `ADM-01,U03` |
| TODO | `POST /auth/google` | `PUBLIC` | `GoogleLogin → AuthSession` | `200` | `GOOGLE_TOKEN_INVALID, ACCOUNT_SUSPENDED, FORBIDDEN` | `U03` |
| TODO | `POST /auth/token/refresh` | `REFRESH` | `TokenRefresh → AccessTokens` | `200` | `TOKEN_EXPIRED, TOKEN_REUSED, TOKEN_INVALID` | `U57` |
| TODO | `POST /auth/logout` | `USER` | `none → none` | `204` | `UNAUTHORIZED` | `U48,U52` |
| TODO | `GET /auth/me` | `USER` | `none → User` | `200` | `UNAUTHORIZED, ACCOUNT_SUSPENDED` | `U57` |
| TODO | `POST /auth/password/forgot` | `PUBLIC` | `OtpRequest → StatusMessage` | `202` | `RATE_LIMITED` | `ADM-01,A01,U04` |
| TODO | `POST /auth/password/verify-otp` | `PUBLIC` | `OtpVerify → ResetGrant` | `200` | `OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED` | `ADM-01,A02,U04` |
| TODO | `POST /auth/password/reset` | `PUBLIC` | `ResetPassword → StatusMessage` | `200` | `RESET_TOKEN_INVALID, RESET_TOKEN_EXPIRED, WEAK_PASSWORD` | `ADM-01,A03,U04` |
| TODO | `POST /auth/password/change` | `USER` | `ChangePassword → StatusMessage` | `200` | `INVALID_CREDENTIALS, WEAK_PASSWORD, AUTH_PROVIDER_UNSUPPORTED` | `U49` |
| TODO | `POST /auth/contact/change-request` | `USER` | `ContactChangeRequest → ContactChangeChallenge` | `202` | `CONTACT_ALREADY_EXISTS, RATE_LIMITED, VALIDATION_ERROR` | `U46` |
| TODO | `POST /auth/contact/change-confirm` | `USER` | `ContactChangeConfirm → User` | `200` | `OTP_INVALID, OTP_EXPIRED, CONTACT_ALREADY_EXISTS` | `U47` |
| TODO | `POST /auth/account/deletion-requests` | `USER` | `AccountDeleteRequest → StatusMessage` | `202` | `REAUTH_REQUIRED, VALIDATION_ERROR` | `U48,U53` |
| TODO | `GET /users/me` | `USER` | `none → User` | `200` | `UNAUTHORIZED` | `USR-35,U05,U18,U26,U27,U32,U33,U43,U46,U48,U50,U51` |
| TODO | `PATCH /users/me/profile` | `USER` | `ProfilePatch → User` | `200` | `VALIDATION_ERROR, UNIVERSITY_MAJOR_MISMATCH, FILE_NOT_READY` | `U05,U46` |
| TODO | `GET /users/me/privacy` | `USER` | `none → PrivacySettings` | `200` | `UNAUTHORIZED` | `U48,U50` |
| TODO | `PATCH /users/me/privacy` | `USER` | `PrivacySettings → PrivacySettings` | `200` | `VALIDATION_ERROR` | `U50` |
| TODO | `GET /users/me/notification-settings` | `USER` | `none → NotificationSettings` | `200` | `UNAUTHORIZED` | `U48,U51` |
| TODO | `PATCH /users/me/notification-settings` | `USER` | `NotificationSettings → NotificationSettings` | `200` | `VALIDATION_ERROR` | `U51` |
| TODO | `GET /users/{userId}/public-profile` | `PUBLIC` | `none → PublicAuthor` | `200` | `NOT_FOUND` | `—` |
| TODO | `POST /users/me/devices` | `USER` | `NotificationDevice → StatusMessage` | `201` | `VALIDATION_ERROR` | `—` |
| TODO | `DELETE /users/me/devices/{deviceId}` | `USER` | `none → none` | `204` | `NOT_FOUND` | `U52` |
| TODO | `GET /admin/users` | `ADMIN:USERS.READ` | `none → Page<User>` | `200` | `FORBIDDEN, QUERY_INVALID` | `ADM-03,ADM-04,A06,A07` |
| TODO | `GET /admin/users/{userId}` | `ADMIN:USERS.READ` | `none → UserAdminDetail` | `200` | `NOT_FOUND, FORBIDDEN` | `ADM-04,A06,A07` |
| TODO | `PATCH /admin/users/{userId}/status` | `ADMIN:USERS.UPDATE` | `AdminUserStatus → User` | `200` | `FORBIDDEN, INVALID_STATE_TRANSITION, VALIDATION_ERROR` | `ADM-03,A04,A05,A48` |
| TODO | `GET /admin/users/{userId}/activity` | `ADMIN:USERS.READ` | `none → Page<AuditEvent>` | `200` | `FORBIDDEN, NOT_FOUND` | `A07` |
| TODO | `GET /admin/users/{userId}/posts` | `ADMIN:USERS.READ` | `none → Page<Post>` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-04` |
| TODO | `GET /admin/users/{userId}/documents` | `ADMIN:USERS.READ` | `none → Page<Document>` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-04` |
| TODO | `GET /admin/users/{userId}/reviews` | `ADMIN:USERS.READ` | `none → Page<Review>` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-04` |
| TODO | `GET /admin/users/{userId}/suggestions` | `ADMIN:USERS.READ` | `none → Page<Suggestion>` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-04` |
| TODO | `GET /admin/users/{userId}/violations` | `ADMIN:USERS.READ` | `none → Page<AuditEvent>` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-04,A07` |
| TODO | `GET /admin/admins` | `SUPER_ADMIN` | `none → Page<Admin>` | `200` | `FORBIDDEN` | `ADM-05,A09` |
| TODO | `POST /admin/admins` | `SUPER_ADMIN` | `AdminCreate → Admin` | `201` | `EMAIL_ALREADY_EXISTS, FORBIDDEN, VALIDATION_ERROR` | `ADM-05,A08` |
| TODO | `GET /admin/admins/{adminId}` | `SUPER_ADMIN` | `none → Admin` | `200` | `NOT_FOUND` | `A09` |
| TODO | `PATCH /admin/admins/{adminId}` | `SUPER_ADMIN` | `AdminPatch → Admin` | `200` | `FORBIDDEN, INVALID_STATE_TRANSITION` | `ADM-05,A09` |
| TODO | `PUT /admin/admins/{adminId}/permissions` | `SUPER_ADMIN` | `AdminPatch → Admin` | `200` | `FORBIDDEN, INVALID_PERMISSION` | `ADM-05,A10` |
| TODO | `DELETE /admin/admins/{adminId}` | `SUPER_ADMIN` | `none → none` | `204` | `FORBIDDEN, INVALID_STATE_TRANSITION` | `ADM-05,A11` |
| TODO | `GET /admin/dashboard` | `ADMIN:STATISTICS.READ` | `none → DashboardStats` | `200` | `FORBIDDEN` | `ADM-02` |
| TODO | `GET /admin/statistics/activity` | `ADMIN:STATISTICS.READ` | `none → Page<TimelinePoint>` | `200` | `FORBIDDEN, QUERY_INVALID` | `ADM-24` |
| TODO | `GET /admin/statistics/overview` | `ADMIN:STATISTICS.READ` | `none → DashboardStats` | `200` | `FORBIDDEN, QUERY_INVALID` | `ADM-24` |
| TODO | `GET /admin/audit-logs` | `ADMIN:AUDIT.READ` | `none → Page<AuditEvent>` | `200` | `FORBIDDEN, QUERY_INVALID` | `ADM-25,A50,A51` |
| TODO | `GET /admin/audit-logs/{auditId}` | `ADMIN:AUDIT.READ` | `none → AuditEvent` | `200` | `FORBIDDEN, NOT_FOUND` | `ADM-25,A50,A51` |

## Các điểm phải chốt khi triển khai

- Trường cụ thể, required/optional, enum và validation của từng DTO; không suy ra chỉ từ tên DTO.
- TTL/attempt limit/cooldown của OTP, access/refresh token; client WEB/MOBILE và cách cấp cookie/token.
- Phân biệt resend OTP xác minh email và đặt lại mật khẩu; purpose/challenge phải được kiểm tra đúng luồng.
- Query/filter/sort/pagination và quyền truy cập nội dung ở các API tổng hợp từ TV2/TV3.
- `AdminPatch` được báo cáo dùng cho cả sửa Admin và full replace permissions: cần chốt schema cụ thể để tránh cập nhật ngoài phạm vi.
- Mỗi operation có test quyền, response/error và UI tương ứng trước khi đổi trạng thái DONE.
