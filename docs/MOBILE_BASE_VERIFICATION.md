# Kiểm tra base App

Ngày kiểm tra: 10/11/2026. Môi trường: Windows, Android emulator x86_64, React Native CLI.

## Lệnh dùng thường xuyên

```powershell
npm run lint
npm run typecheck
npm test -- --runInBand
npm start
```

Terminal khác khi cần build native:

```powershell
npm run android
```

Nếu emulator thiếu dung lượng với APK nhiều kiến trúc, có thể build riêng x86_64 cho emulator này:

```powershell
cd android
.\gradlew.bat :app:installDebug -PreactNativeArchitectures=x86_64 --console=plain
```

Tham số x86_64 chỉ dùng cho emulator tương ứng, không dùng bản APK này cho điện thoại ARM. Cấu hình kiến trúc mặc định của dự án vẫn giữ nguyên. Cần Metro đang chạy để bản debug nạp JavaScript.

## Kiểm tra đã thực hiện

- Baseline trước thay đổi: lint, TypeScript và test render mẫu đạt; người dùng xác nhận đã chạy App Android.
- Build native có react-native-screens và react-native-svg thành công. APK nhiều kiến trúc bị emulator từ chối vì thiếu dung lượng; APK x86_64 cài thành công, không xóa dữ liệu emulator.
- Kiểm tra ảnh giao diện Welcome, Trang chủ, Cá nhân và modal yêu cầu đăng nhập trên emulator.
- Test API client: success envelope, 204, 422/field errors, không retry mutation, invalid response, 429, network, cancellation và timeout.
- Test modal state: thay modal, giữ nội dung dirty, stay/discard và không ghi đè quyết định đang chờ.
- Test App: Welcome → đăng nhập → đổi sang đăng ký trong một Modal → tiếp tục Khách → Trang chủ.

Kết quả cuối cùng của lint/typecheck/test và các bước Android bổ sung được ghi vào nhật ký trong `TV1_IMPLEMENTATION_PLAN.md`. Ảnh/log cục bộ ở `artifacts/`, đã được bỏ qua bởi Git.

## Kiểm tra thủ công khi thay đổi điều hướng

1. Mở App mới: Welcome, nội dung có thể cuộn, nút không bị che bởi thanh hệ thống.
2. Bắt đầu khám phá: có đủ 5 tab, mỗi tab mở đúng nội dung, nút Back đi theo lịch sử tab.
3. Cá nhân → mục riêng tư: hiện yêu cầu đăng nhập; chuyển qua màn auth không chồng modal; Back/Đóng trở lại đúng tab.
4. Cài đặt → về Welcome; auth → tiếp tục Khách trở lại App.
5. Đổi cỡ chữ/màn hình khi có thiết bị phù hợp; kiểm tra các nút dài vẫn đọc được.

Auth và các domain đang ở trạng thái chờ. Những bước trên chỉ xác minh base, không xác minh đăng nhập, lưu hồ sơ hoặc API nghiệp vụ.

## Chạy App cùng Backend (Android emulator)

1. Backend: `cd backend && npm run start:dev` (cần MongoDB và `backend/.env`, xem `backend/README.md`). Ở dev, mã OTP in ra log của backend.
2. App gọi `http://10.0.2.2:3000/api/v1` (địa chỉ máy chủ nhìn từ emulator, xem `src/shared/config.ts`). Bản release phải đổi sang URL HTTPS thật.
3. Module `react-native-keychain` là native: sau khi thêm hoặc cập nhật phải build lại (`gradlew :app:installDebug`), nếu không app báo thiếu `RNKeychainManager`.
4. Kiểm tra thủ công đã làm trên emulator (10/11/2026): đăng ký, nhận OTP, đăng nhập khi chưa xác minh (có nút "Xác minh email"), xác minh, vào app, tab Cá nhân hiện đúng tài khoản, tắt hẳn app rồi mở lại vẫn đăng nhập (khôi phục từ Keychain), đăng xuất về Welcome và mở lại vẫn ở Welcome. Phía MongoDB: phiên cũ bị thu hồi khi xoay vòng, token chỉ lưu dạng băm, đăng xuất thu hồi mọi phiên.

Mẹo khi điều khiển emulator bằng `adb`: Gboard có thể hiện thanh viết tay che màn hình (bấm "Got it" và tắt `stylus_handwriting_enabled`); `adb shell input text` gõ nhanh sẽ làm rơi ký tự ở bản debug chậm nên cần gõ từng ký tự; BACK khi bàn phím ẩn sẽ đóng modal (đúng hành vi Android).
