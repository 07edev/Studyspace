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

> **Keystore debug của dự án:** `android/app/debug.keystore` là keystore riêng của StudySpace (đã commit, mật khẩu
> `android` như mọi debug keystore, không phải bí mật). Mọi thành viên build debug đều ký bằng nó nên dùng chung
> một SHA-1: `CB:52:D2:6A:17:C1:7A:0F:97:6F:7C:4E:2B:C5:1D:66:27:94:87:EC`. Bản release sau này phải dùng
> keystore khác và thêm SHA-1 của nó vào client Android.

## 2. Cấu hình backend

Trong `backend/.env`, liệt kê các client id được chấp nhận (cách nhau bằng dấu phẩy):

```
GOOGLE_CLIENT_IDS=<web-client-id>.apps.googleusercontent.com
```

Để trống thì `POST /auth/google` trả `503 GOOGLE_NOT_CONFIGURED`.

## 3. Phía app

- Đã cài `@react-native-google-signin/google-signin`. `src/features/auth/googleSignIn.ts` gọi
  `GoogleSignin.configure({ webClientId })` rồi `signIn()`, nút "Tiếp tục với Google"
  (`GoogleSignInButton`, có ở form đăng nhập và đăng ký) gửi `idToken` tới `POST /auth/google`.
- Web client id nằm ở `GOOGLE_WEB_CLIENT_ID` trong `src/shared/config.ts` (id công khai, không phải
  bí mật) và phải **trùng** với `GOOGLE_CLIENT_IDS` của backend.
- **Không** đưa *Client secret* vào app hay vào repo; luồng này không cần nó.
- Cần thêm client **Android** (`com.studyspace` + SHA-1) **trong cùng project Google Cloud** với client Web,
  nếu không app báo lỗi `DEVELOPER_ERROR` (mã 10). Mỗi máy dev có keystore debug riêng thì thêm SHA-1 của máy đó.
- Emulator phải dùng image có **Google Play** (ví dụ `google_apis_playstore`) và đăng nhập sẵn một tài khoản Google.

## Hành vi phía backend

- Chỉ chấp nhận email Google đã xác minh (`email_verified`).
- Email đã có tài khoản mật khẩu thì liên kết thêm `GOOGLE` vào tài khoản đó.
- Tài khoản bị khóa trả `403 ACCOUNT_SUSPENDED`; token sai trả `401 GOOGLE_TOKEN_INVALID`.
