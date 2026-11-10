# Làm việc nhóm với Git

Repo: https://github.com/07edev/Studyspace. Ba người cùng làm, nên có vài quy tắc để ít xung đột.

## Nhánh

- `main` luôn chạy được. **Không push thẳng vào `main`**; mọi thay đổi đi qua Pull Request (PR).
- Mỗi việc một nhánh, đặt tên `<loại>/<tv>-<việc>`: `feature/tv2-places-list`, `fix/tv3-upload-timeout`, `docs/team-workflow`.
- Nhánh ngắn hạn: vài ngày, PR nhỏ. Nhánh sống lâu sẽ xung đột nhiều.

## Quy trình một việc

```sh
git checkout main && git pull
git checkout -b feature/tv2-places-list
# ... làm việc, commit nhỏ ...
git fetch origin && git merge origin/main     # kéo main về thường xuyên, nhất là trước khi mở PR
npm run lint && npm run typecheck && npm test # xem README, mục "Kiểm tra trước khi tạo PR"
git push -u origin feature/tv2-places-list
```

Rồi mở PR trên GitHub vào `main`. Điền mẫu PR (có sẵn). Nhờ **ít nhất 1 người khác** xem. Sau khi merge, xóa nhánh cũ và `git pull` lại `main`.

## Commit

- Thông điệp: `loại(phạm vi): mô tả ngắn`, ví dụ `feat(app): add places list`, `fix(backend): reject expired token`, `docs: update README`.
- Loại thường dùng: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Mỗi commit một ý. Không gom nhiều việc không liên quan vào một commit.
- **Không commit** `.env`, mật khẩu, token, khóa riêng. Nếu lỡ commit, báo cả nhóm ngay để đổi khóa (xóa file khỏi commit sau là chưa đủ vì lịch sử vẫn còn).
- Không dùng `git push --force` trên nhánh đã có người khác kéo về.

## Ai sở hữu thư mục nào

Theo [phân công](../README.md#phân-công), mỗi người sở hữu module của mình và chỉ sửa module người khác khi đã thống nhất.
`.github/CODEOWNERS` tự yêu cầu đúng người duyệt khi PR chạm vào thư mục của họ.

Các file **cả nhóm cùng chạm vào** (dễ xung đột), nên chỉ **thêm dòng của mình**, không sắp xếp lại cả file:

| File | Khi nào chạm |
| --- | --- |
| `src/navigation/types.ts`, `ModalHost.tsx`, `AppTabs.tsx` | Thêm route, modal, màn hình mới |
| `package.json`, `package-lock.json` (App và `backend/`) | Cài thư viện mới |
| `backend/src/app.module.ts` | Đăng ký module mới |
| `src/shared/contracts/*`, `src/shared/ui/*` | Thêm kiểu dữ liệu, component dùng chung |

Ai cài thư viện mới thì commit cả `package-lock.json` và báo trong nhóm. Thư viện native (có mã Android/iOS) cần build lại app:
báo rõ trong PR để người khác chạy lại `npm install` và build.

## Hợp đồng giữa các phần

- TV2 và TV3 **không sửa** code xác thực/phân quyền của TV1; dùng decorator có sẵn (`@Public()`, `@RequirePermission(...)`,
  `@CurrentUser()`...) theo bảng trong [backend/README.md](../backend/README.md).
- Lấy người dùng hiện tại từ `@CurrentUser()`, **không** tin `userId` trong body.
- Cần thêm trường hoặc endpoint dùng chung: mở issue hoặc nhắn trước khi sửa, để cập nhật cả backend lẫn App.
- Đổi tên trường API phải khớp tài liệu đặc tả gốc (bản `.docx`), không đoán từ PDF.

## Review PR

- Người duyệt xem: chạy được không, test có không, có lộ bí mật không, có sửa file ngoài phạm vi không.
- Góp ý cụ thể, ngắn gọn. Người viết trả lời hoặc sửa, rồi báo lại.
- Không merge PR đang đỏ (lint, typecheck, test lỗi).
- Hai người cùng sửa một chỗ: người merge sau xử lý xung đột. Không đoán; hỏi người kia nếu không chắc.

## Việc cần làm một lần (chủ repo)

Trên GitHub, Settings → Branches → Add rule cho `main`:
- *Require a pull request before merging*, yêu cầu 1 duyệt.
- Cân nhắc *Require status checks* khi đã có CI.

Mời TV2 và TV3 ở Settings → Collaborators. Cập nhật `.github/CODEOWNERS` bằng tên GitHub của họ.
