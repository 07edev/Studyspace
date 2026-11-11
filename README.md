# StudySpace (G1)

Ứng dụng tìm nơi học, chia sẻ tài liệu và cộng đồng học tập. Nhóm 3 người; repo gồm ba phần:

| Thư mục | Nội dung | Công nghệ |
| --- | --- | --- |
| `/` (gốc), `src/`, `android/`, `ios/` | App di động | React Native CLI 0.88, TypeScript |
| `backend/` | API `/api/v1` | NestJS 11, MongoDB (Mongoose 9) |
| `web-admin/` | Web quản trị: khung, đăng nhập, phân quyền, quản lý người dùng và Admin ([hướng dẫn](web-admin/README.md)) | React 19 + Vite 8 |

Phạm vi G1: màn Welcome + 5 tab, không Drawer. Không có booking, thanh toán, gói đăng ký, chat realtime.

## Cài đặt lần đầu

Yêu cầu: Node.js >= 22.11, JDK 17+, Android Studio + SDK, MongoDB đang chạy
(`mongodb://127.0.0.1:27017` hoặc Atlas). Làm theo
[Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) của React Native nếu chưa có Android.

```sh
git clone https://github.com/07edev/Studyspace.git
cd Studyspace
npm install                      # App
cd backend && npm install        # Backend
```

## Chạy Backend

```sh
cd backend
cp .env.example .env             # Windows: copy .env.example .env
# mở .env, điền JWT_ACCESS_SECRET (>= 32 ký tự) và MONGODB_URI
npm run start:dev
```

Sinh secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
Kiểm tra: `http://localhost:3000/api/v1/health` phải trả `status: ok`. Swagger: `http://localhost:3000/api/docs`.

`backend/.env` **không được commit** (đã gitignore): mỗi người tự tạo từ `.env.example`.
Không cấu hình SMTP thì mã OTP được in ra log của backend (chỉ ở dev). Gửi mail thật: [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md).
Đăng nhập Google: [docs/GOOGLE_SIGNIN_SETUP.md](docs/GOOGLE_SIGNIN_SETUP.md).

## Chạy App (Android emulator)

Terminal 1: `npm start` (Metro). Terminal 2: `npm run android`.
Emulator gọi backend ở `http://10.0.2.2:3000/api/v1` (xem `src/shared/config.ts`). Chi tiết và mẹo:
[docs/MOBILE_BASE_VERIFICATION.md](docs/MOBILE_BASE_VERIFICATION.md).

Đăng nhập Google cần emulator có **Google Play** (image `google_apis_playstore`) và email thử nằm trong **Test users**
của project Google Cloud.

iOS chưa được kiểm tra (nhóm dùng Windows).

## Kiểm tra trước khi tạo PR

```sh
npm run lint && npm run typecheck && npm test            # App
cd backend && npm run typecheck && npm test              # Backend (cần MongoDB)
```

## Tài liệu

- [docs/TEAM_WORKFLOW.md](docs/TEAM_WORKFLOW.md): cách làm việc nhóm với Git (đọc đầu tiên)
- [docs/COMPONENTS.md](docs/COMPONENTS.md): component và công cụ dùng chung của App (đọc trước khi viết giao diện)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): kiến trúc App, điều hướng, modal, API client
- [backend/README.md](backend/README.md): decorator và dịch vụ dùng chung cho TV2/TV3
- [docs/TV1_API_CHECKLIST.md](docs/TV1_API_CHECKLIST.md): danh sách API của TV1 và trạng thái
- [docs/TV1_IMPLEMENTATION_PLAN.md](docs/TV1_IMPLEMENTATION_PLAN.md): kế hoạch và nhật ký tiến độ của TV1

## Phân công

| Người | Phụ trách |
| --- | --- |
| TV1 | Core/Identity: đăng nhập, người dùng, quản trị viên, nhật ký, base Backend/Web/App |
| TV2 | Địa điểm (Places) và phân loại (Taxonomy) |
| TV3 | Nội dung, tải file, báo cáo, thông báo |
