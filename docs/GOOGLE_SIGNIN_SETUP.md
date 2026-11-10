# Cấu hình đăng nhập Google

Backend xác minh `idToken` do app gửi lên (chữ ký, issuer, audience, hạn dùng) bằng `google-auth-library`.
Cần một **OAuth client** trên Google Cloud; phần này phải làm bằng tài khoản Google của bạn.

## 1. Tạo OAuth client

1. Vào console.cloud.google.com, tạo project (ví dụ `StudySpace`).
2. **APIs & Services → OAuth consent screen**: chọn *External*, điền tên app và email hỗ trợ.
   Trong lúc chưa publish, thêm email của các thành viên vào **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, tạo:
   - **Web application** (bắt buộc): client id này là `audience` của idToken khi app dùng `webClientId`.
   - **Android**: package name `com.studyspace`, kèm SHA-1 của keystore:
     `cd android && ./gradlew signingReport` (lấy SHA-1 của variant `debug`; thêm SHA-1 bản release sau này).
   - **iOS** (nếu cần): bundle id của app iOS.

## 2. Cấu hình backend

Trong `backend/.env`, liệt kê các client id được chấp nhận (cách nhau bằng dấu phẩy):

```
GOOGLE_CLIENT_IDS=<web-client-id>.apps.googleusercontent.com
```

Để trống thì `POST /auth/google` trả `503 GOOGLE_NOT_CONFIGURED`.

## 3. Phía app (làm ở bước App U03)

- Cài `@react-native-google-signin/google-signin`, gọi
  `GoogleSignin.configure({ webClientId: '<web-client-id>' })` rồi `signIn()`, gửi `idToken` tới `POST /auth/google`.
- Client id không phải bí mật, nhưng vẫn đặt qua cấu hình build, không viết cứng trong mã.

## Hành vi phía backend

- Chỉ chấp nhận email Google đã xác minh (`email_verified`).
- Email đã có tài khoản mật khẩu thì liên kết thêm `GOOGLE` vào tài khoản đó.
- Tài khoản bị khóa trả `403 ACCOUNT_SUSPENDED`; token sai trả `401 GOOGLE_TOKEN_INVALID`.
