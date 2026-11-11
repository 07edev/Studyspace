# StudySpace Web Admin

React 19 + Vite + TypeScript. Trang quản trị cho Admin / Super Admin. Có khung ứng dụng, đăng nhập (ADM-01 + A01–A03), phân quyền menu, bộ component dùng chung và các trang của TV1:
**Người dùng** (ADM-03, ADM-04, A04–A07), **Quản lý Admin** (ADM-05, A08–A11), **Tổng quan** (ADM-02), **Thống kê hoạt động** (ADM-24) và **Nhật ký quản trị** (ADM-25, A50, A51). Các trang của TV2/TV3 chưa có (hiện là trang "Chưa xây dựng").

## Chạy

```bash
# 1) Backend (cổng 3000) và MongoDB đang chạy: xem ../backend/README.md
# 2) Tạo tài khoản Super Admin để đăng nhập thử (chỉ môi trường phát triển)
cd ../backend
SEED_ADMIN_PASSWORD='MatKhau-Cua-Ban-1' npm run seed:admin      # hoặc bỏ biến để tự sinh mật khẩu, in ra một lần
# 3) Web
cd ../web-admin
npm install
npm run dev            # http://localhost:5173
```

Đăng nhập bằng `admin@studyspace.local` (đổi bằng biến `SEED_ADMIN_EMAIL`) và mật khẩu ở bước 2. Chạy lại seed không tạo tài khoản
thứ hai; thêm `-- --reset-password` nếu muốn đặt lại mật khẩu. Seed từ chối chạy khi `NODE_ENV=production`.

Dev server chuyển tiếp `/api` sang `http://localhost:3000` (đổi bằng `VITE_DEV_API`), nên trình duyệt chỉ nói chuyện với một origin và
cookie làm mới phiên (HttpOnly, SameSite=Strict) hoạt động mà không cần cấu hình CORS. Khi triển khai thật, đặt `VITE_API_BASE_URL`
và thêm origin của web vào `CORS_ORIGINS` của backend.

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy phát triển |
| `npm run build` | Typecheck + build ra `dist/` |
| `npm run typecheck` | Chỉ kiểm tra kiểu |
| `npm test` | Vitest + Testing Library. **Chạy từ terminal có ổ đĩa viết HOA (`C:\...`)**: trên Windows, đường dẫn viết thường (`c:\...`) khiến Vitest nạp hai bản module và báo "failed to find the current suite" |

## Cấu trúc

```
src/
  app/        App (routes), AdminShell (menu + thanh trên), Providers, registry.tsx  <- danh sách trang
  auth/       AuthProvider (phiên), permissions.ts (can), guards.tsx (RequireAdmin, PermissionGate)
  lib/        api.ts (client), query.ts (TanStack Query + queryKeys + usePagedQuery)
  features/   users/ (ADM-03/04, A04–A07), admins/ (ADM-05, A08–A11), stats/ (ADM-02, ADM-24), audit/ (ADM-25, A50, A51)
  pages/      LoginPage (ADM-01), ForgotPasswordFlow (A01–A03), PendingPage
  ui/         component dùng chung
  styles/     app.css (token màu cùng bảng màu với App)
```

Kiểu dữ liệu API (`User`, `Page<T>`, `ApiFailure`…) lấy từ `../src/shared/contracts` qua alias `@contracts/*` (chỉ kiểu, không có mã chạy),
nên App và Web dùng chung một định nghĩa.

## Dùng lại phần của TV1

- `UserStatusDialog` (`features/users`): hộp khóa/mở khóa có lý do ≥ 10 ký tự. TV3 dùng cho A48 (xử lý tài khoản liên quan).
- `ContentTab` trong `UserDetailPage`: tab Bài viết/Tài liệu/Đánh giá/Đề xuất đang hiện danh sách chung (`title`/`name`/`id`); chủ sở hữu dữ liệu thay bằng cột của mình khi nối backend.
- `PermissionMatrix` (`features/admins`): bảng quyền theo mục × thao tác. Module mới dùng thao tác nào thì thêm vào `PERMISSION_CATALOG`.
- `ModalCancel`: nút Hủy trong form của `Modal`; **luôn dùng nút này**, không tự gọi `onClose`, để hộp "Rời khỏi form?" hoạt động.

## Biểu đồ và số liệu

- `ui/charts/LineChart`: một chuỗi theo thời gian (đường 2px, lưới mảnh, chấm cuối kèm giá trị, đường dọc + chú thích khi rê chuột hoặc dùng phím mũi tên/Home/End). Mỗi chỉ số một biểu đồ riêng vì thang đo khác nhau; luôn có chế độ bảng cùng số liệu (xem `ActivityPage`). Màu dùng bảng màu chuẩn của skill dataviz (xanh dương, đã kiểm `validate_palette`).
- Số liệu của bạn lên dashboard/thống kê: đăng ký nguồn ở **backend** (`StatsRegistry`, xem `backend/README.md`); Web tự hiện khi có. Muốn thêm một chuỗi mới vào ADM-24, thêm vào `SERIES` trong `features/stats/ActivityPage.tsx` và vào backend.
- Nhãn tiếng Việt cho hành động/đối tượng trong nhật ký: thêm vào `features/audit/audit.ts` (chưa có thì hiện mã gốc).

## Thêm một trang (TV2 / TV3)

1. Viết trang trong thư mục của bạn, ví dụ `src/features/places/PlacesPage.tsx`.
2. Trong `src/app/registry.tsx`, tìm dòng của trang và **thay `element`** (chỉ sửa dòng của mình). Trang chi tiết (ví dụ
   `places/:placeId`) thêm vào `extraRoutes` của cùng dòng.
3. Menu, đường dẫn và kiểm tra quyền (`access`) tự có từ dòng đó. Trang không đủ quyền hiện "Bạn không có quyền truy cập trang này".

Quyền nút bấm bên trong trang: `<PermissionGate access={{ module: 'PLACES', action: 'UPDATE' }}><Button>Sửa</Button></PermissionGate>`.
Ẩn menu/nút chỉ để giao diện gọn, **không phải lớp bảo mật**: server kiểm tra quyền ở mọi API.

## Component (`src/ui`)

| Component | Dùng khi |
| --- | --- |
| `Button` | `variant`: primary, secondary, ghost, danger; `loading`, `block`, `small` |
| `TextField`, `TextArea`, `SelectField`, `Checkbox` | Form; có `label`, `error`, `hint` và gắn `aria-*` đúng |
| `Badge`, `Card`, `PageHeader` | Trạng thái, khối nội dung, tiêu đề trang |
| `Modal` | `size`: **C** hộp nhỏ/xác nhận, **L** sheet, **F** toàn màn hình. Có khóa Tab trong hộp, Esc/bấm nền để đóng, `dirty` để hỏi "Rời khỏi form?" |
| `useConfirm()` | `if (await confirm({ title: 'Xóa?', destructive: true })) …` — nút Hủy được focus sẵn |
| `useToast()` | `toast('Đã lưu.')`, `toast('Lỗi…', 'error')` |
| `DataTable` + `Pagination` | Danh sách phân trang theo `Page<T>`: tải lần đầu, lỗi + thử lại, rỗng, giữ dữ liệu cũ khi tải trang mới |
| `EmptyState`, `ErrorState`, `LoadingState`, `Spinner` | Trạng thái. `ErrorState` hiện mã yêu cầu để tra log |
| `useSubmit()` | Chặn bấm hai lần; đổi lỗi 422 thành lỗi theo trường (`fields`) và một thông báo chung (`message`) |

Dữ liệu từ API: `useApiQuery` và `usePagedQuery` (`src/lib/query.ts`), **không gọi `fetch` trực tiếp**. Khóa query theo dạng
`[miền, tài nguyên, ...tham số]`, thêm vào `queryKeys`. Mẫu danh sách:

```tsx
const list = usePagedQuery<User>(queryKeys.users.list(filters), '/admin/users', filters);
<DataTable query={list} page={list.page} onPageChange={list.setPage} rowKey={u => u.id} caption="Người dùng"
           columns={[{ key: 'email', header: 'Email', render: u => u.email }]} />
```

## Phiên đăng nhập

- Access token chỉ nằm trong bộ nhớ (mất khi tải lại trang). Refresh token nằm trong cookie HttpOnly nên JavaScript không đọc được.
- Mở trang: gọi `POST /auth/token/refresh` (kèm `X-Requested-With`) rồi `GET /auth/me`; có phiên và là admin đang hoạt động thì vào thẳng.
- Gặp 401 mã `UNAUTHORIZED/TOKEN_EXPIRED/TOKEN_INVALID`: làm mới **một lần** rồi gửi lại **một lần**. Nhiều request cùng lúc dùng chung một lần làm mới
  (token xoay vòng, làm mới song song bị server coi là bị đánh cắp). 401 khác (ví dụ sai mật khẩu) không đăng xuất ai.
- Server từ chối làm mới (hết hạn, bị khóa) → về trang đăng nhập kèm thông báo. Mất mạng thì **không** đăng xuất, chỉ báo lỗi và cho thử lại.
- Đăng nhập/đăng xuất xóa cache dữ liệu, nên người sau không thấy dữ liệu người trước.
