# Component và công cụ dùng chung (App)

Mọi thứ nằm trong `src/shared/`. **Dùng lại trước khi tự viết**; cần thêm hoặc sửa thì mở PR và báo cả nhóm.
Màu, khoảng cách, bo góc lấy từ `shared/theme/tokens.ts`, không viết cứng mã màu.

```ts
import { Button, TextField, useConfirm, PagedList /* ... */ } from '../../shared/ui';
import { usePagedQuery, useApiQuery, queryKeys } from '../../shared/query';
```

## Giao diện (`shared/ui`)

| Component | Dùng khi | Ghi chú |
| --- | --- | --- |
| `AppText` | Mọi chữ | `variant`: hero, title, heading, body, caption, label; `muted` |
| `Button` | Mọi nút | `variant`: primary, secondary, ghost, **danger**; có `loading`, `disabled` |
| `TextField` | Ô nhập | Có `label`, `error`, `hint`; truyền tiếp mọi prop của `TextInput` |
| `SwitchRow` | Bật/tắt một cài đặt | Lưu ngay khi gạt; xem `useRemoteSettings` |
| `Checkbox` | Chọn nhiều, ô "tôi đồng ý" | Có `error` |
| `SelectField` | Chọn **một** trong danh sách **ngắn** (≤ ~10) | Danh sách mở ngay dưới ô. Danh sách dài/tìm kiếm (trường, tỉnh) làm thành màn riêng như U07/U08 |
| `Chip` | Bộ lọc, thẻ | Có `selected` + `onPress` là nút; không có là nhãn tĩnh |
| `Avatar` | Ảnh người dùng | Ảnh → chữ cái đầu → biểu tượng |
| `Card`, `Screen` | Khối nội dung, khung màn hình | `Screen` lo safe area và cuộn |
| `MenuGroup` + `MenuRow` | Danh sách dòng bấm được | Dùng ở Cá nhân, Cài đặt |
| `EmptyState`, `ErrorState`, `LoadingState` | Trạng thái rỗng, lỗi, đang tải | |
| `PagedList` | **Màn danh sách có phân trang** | Xử lý đủ: tải lần đầu, lỗi + thử lại, rỗng, kéo làm mới, tải thêm, lỗi trang kế |
| `UploadPicker` + `ProgressBar` | Chọn và tải ảnh/tệp | Xem mục "Tải tệp" |
| `useToast()` | Thông báo ngắn | `toast('Đã lưu.')` |
| `useConfirm()` | Hộp xác nhận | Xem bên dưới |

### Hộp xác nhận

```ts
const confirm = useConfirm();
if (await confirm({ title: 'Xóa bài viết?', message: 'Không thể hoàn tác.', confirmLabel: 'Xóa', destructive: true })) {
  // người dùng đã đồng ý
}
```

Trả `true` khi đồng ý, `false` khi hủy, bấm ra ngoài hoặc nhấn Back. Dùng được trên màn hình thường và cả
**trên một modal đang mở** (không đóng modal). Chỉ `ModalHost` tạo `Modal` native, nên đừng tự tạo thêm `Modal`.

### Form trong modal

- `useSubmit()`: chặn bấm hai lần, đổi lỗi thành `fields` (theo trường) và `message` (chung).
- `useDirtyGuard(coThayDoi)`: hỏi "Rời khỏi form?" nếu đóng khi còn dữ liệu chưa lưu.
- Mẫu hoàn chỉnh: `features/profile/ProfileEditForm.tsx`.

## Dữ liệu từ API (`shared/query`)

Dùng TanStack Query. **Không gọi `fetch` trực tiếp** trong màn hình.

```ts
// Một đối tượng
const place = useApiQuery<Place>(queryKeys.places.detail(id), `/places/${id}`, { enabled: !!id });
// place.data, place.isPending, place.error (ApiError), place.refetch()

// Danh sách phân trang theo hợp đồng Page<T> ({ items, pagination: { page, hasNext } })
const list = usePagedQuery<Place>(queryKeys.places.list(filters), '/places', filters);
return <PagedList query={list} keyExtractor={p => p.id} renderItem={p => <PlaceCard place={p} />} />;

// Sau khi sửa dữ liệu: làm mới đúng phần bị ảnh hưởng
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: queryKeys.places.all });
```

- **Khóa query** theo dạng `[miền, tài nguyên, ...tham số]`; thêm hàm tạo khóa của mình vào `queryKeys.ts`.
  Truyền bộ lọc là **một object**, không rải thành nhiều phần tử.
- API công khai (không cần đăng nhập) đặt `{ authenticated: false }`.
- Không tự thử lại lỗi 4xx (404, 422, 403...); lỗi mạng và 5xx thử lại tối đa 2 lần.
- Cache bị làm mới khi người đang đăng nhập đăng xuất hoặc đổi tài khoản, nên dữ liệu người cũ không lộ cho người sau.
- Lỗi luôn là `ApiError` có `code`, `message` (tiếng Việt), `status`, `details`.

## Tải tệp (`shared/upload` + `UploadPicker`)

`UploadPicker` lo giao diện: chọn → thanh tiến trình → xong/lỗi (thử lại) → đổi hoặc gỡ. Nó **chỉ báo `fileId` cho màn hình
sau khi server báo READY** (`onChange(fileId | null)`), và kiểm tra loại tệp/dung lượng trước khi tải.

```tsx
<UploadPicker label="Ảnh đại diện" uploader={fileUploader} rules={IMAGE_RULES}
              chooseLabel="Chọn ảnh" onChange={id => setAvatarFileId(id)} />
```

**TV3** cần cung cấp một `FileUploader` (xem `shared/upload/types.ts`): `pick()` mở thư viện ảnh của hệ điều hành
(không gọi API), `upload(file, onProgress, signal)` thực hiện khởi tạo → gửi tệp → hoàn tất → chờ READY rồi trả `{ fileId }`.
Thư viện chọn ảnh native chưa được cài; TV3 chọn và cài khi nối upload thật.

## Hành động cần đăng nhập (U19)

Mọi nút "cần tài khoản" (lưu địa điểm, bình luận, đăng bài, đánh giá…) gọi `requireAuth`, **không tự mở màn đăng nhập**:

```tsx
const { requireAuth } = useAuthGate();   // shared/auth/AuthGate
const { open } = useModal();

<Button title="Lưu" onPress={() =>
  requireAuth({
    reason: 'Đăng nhập để lưu địa điểm này.',          // hiện trong U19
    action: () => saveFavorite(place.id),               // chạy ngay nếu đã đăng nhập; nếu chưa, chạy sau khi đăng nhập xong
    isStillValid: () => place.id === currentPlaceId,    // (tùy chọn) kiểm tra trước khi chạy lại
  })
} />
```

- Đã đăng nhập: `action` chạy ngay. Chưa: mở U19 (Đăng nhập / Tạo tài khoản / Để sau), nhớ yêu cầu và **chạy đúng một lần** khi đăng nhập xong (sau cả bước hoàn thiện hồ sơ nếu vừa đăng ký).
- Bỏ yêu cầu khi người dùng đóng U19 hoặc màn đăng nhập, khi quá 10 phút (`maxAgeMs`), hoặc khi `isStillValid` trả `false` (có thông báo). Yêu cầu mới thay yêu cầu cũ.
- **Giữ nháp**: biểu mẫu đang mở sẽ đóng khi sang đăng nhập, nên đưa nội dung đã gõ vào closure của `action` (ví dụ `action: () => submitComment(text)`) hoặc mở lại biểu mẫu với nội dung đó.
- `action` lỗi: người dùng thấy `ApiError.message` (hoặc câu chung), không bị treo. Trang cho phép khách xem thì không cần gọi `requireAuth`; chỉ gọi ở thao tác ghi.
- Mẫu thật: `features/profile/ProfileScreen.tsx` (các dòng "Góc học của tôi") và chuông thông báo ở `HomeScreen`.

## Thêm màn hình hoặc modal mới

- Tab: đăng ký màn hình ở `navigation/AppTabs.tsx`.
- Modal: thêm route vào `navigation/types.ts`, tiêu đề + cỡ (C/L/F) ở `presentation()` và nội dung ở `ModalContent` trong
  `navigation/ModalHost.tsx`. Chỉ thêm dòng của mình, không sắp xếp lại file.
- Cỡ modal: **C** hộp xác nhận, **L** sheet, **F** toàn màn hình.
