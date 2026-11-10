# Cấu hình email (OTP) cho StudySpace

Backend gửi mã OTP (xác minh email, đặt lại mật khẩu, đổi email) qua **SMTP**, nên dùng được với bất kỳ nhà cung cấp nào.
Khi `SMTP_HOST` để trống (chỉ ở môi trường phát triển) mã được in ra log của backend thay vì gửi email.
Ở production, thiếu `SMTP_HOST`/`MAIL_FROM` thì backend từ chối khởi động.

## Nên chọn gì

| Mục đích | Khuyến nghị | Lý do |
| --- | --- | --- |
| Chạy thật / demo cho nhóm | **Brevo** (SMTP) | Miễn phí 300 email/ngày, không cần thẻ, không cần sở hữu tên miền (chỉ xác minh một email người gửi), có thống kê gửi |
| Thử nhanh ngay hôm nay | **Gmail + App Password** | Không cần đăng ký thêm; giới hạn ~500 email/ngày; người gửi bắt buộc là chính Gmail đó |
| Tránh | Resend, SES, SendGrid | Cần tên miền hoặc xác minh phức tạp hơn mức cần cho G1 |

## Brevo

1. Đăng ký tại brevo.com, xác minh email.
2. Vào **Senders, Domains & Dedicated IPs → Senders** và thêm email người gửi (xác nhận qua link được gửi tới email đó).
3. Vào **SMTP & API → SMTP**, tạo **SMTP key**.
4. Điền `backend/.env`:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<SMTP login hiển thị trong trang SMTP>
SMTP_PASS=<SMTP key vừa tạo>
MAIL_FROM=StudySpace <email người gửi đã xác minh>
```

## Gmail (chỉ để thử)

1. Bật xác minh 2 bước cho tài khoản Google.
2. Tạo **App Password** tại myaccount.google.com/apppasswords.
3. Điền `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<địa chỉ gmail>
SMTP_PASS=<App Password 16 ký tự, không phải mật khẩu Gmail>
MAIL_FROM=StudySpace <địa chỉ gmail>
```

## Kiểm tra

```
cd backend
npm run mail:test -- <email nhận thử>
```

Lệnh gửi một email thật (mã giả `000000`) bằng cấu hình trong `.env`. Nhận được là cấu hình đúng. Nếu vào thư rác, đánh dấu "Không phải thư rác".

Không commit `.env`. Nếu lộ SMTP key hoặc App Password, hãy thu hồi và tạo lại ngay.

## SMS (số điện thoại)

Chưa tích hợp, có chủ đích:

- Số điện thoại là tùy chọn trong G1; mọi luồng chính (đăng ký, đặt lại mật khẩu) dùng email.
- Gửi SMS OTP ở Việt Nam cần đăng ký thương hiệu (brandname) với nhà mạng và trả phí theo tin.
- Vì vậy đổi số điện thoại (`/auth/contact/change-request` với `channel: PHONE`) trả `503 SMS_NOT_CONFIGURED`
  kèm thông báo tiếng Việt, thay vì giả vờ gửi.

Khi cần, thêm một adapter (eSMS hoặc SpeedSMS là hai lựa chọn phổ biến ở Việt Nam) trong
`backend/src/modules/auth/mail.service.ts`: hiện thực `sendOtp({ phone })` và trả `canSendSms() = true`.
