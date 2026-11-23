# Ke hoach trien khai thanh vien 3 — Content/Moderation

Cap nhat: 22/11/2026. Pham vi theo `StudySpace_G1_BaoCao_PhanTich_PhanCong_3Nguoi_Fullstack.docx`.

## 1. Hien trang va pham vi

TV3 so huu Posts, Comments, Documents, Uploads, Reports, Notifications, AdminPosts,
AdminComments, AdminDocuments va AdminReports; tong cong 48 API theo bang 7.3 cua bao cao.
TV3 cung so huu tab Cong dong/Tai lieu, 20 App Modal, ADM-16/17/18/19/22/23 va cac modal
A35-A49.

Kiem tra repository sau dot trien khai:

- Backend Posts/Comments da co feed, CRUD, thread mot cap, counter, attachment checks,
  moderation, audit va notification; Files, Documents, Reports, Notifications va admin APIs
  da duoc tao va dang ky.
- App tabs Cong dong/Tai lieu da noi API; co upload picker chung cho anh bai viet, tai lieu
  va evidence, cung cac luong edit/delete, replies, report history va notifications.
- Web Admin da co cac trang noi dung/posts/comments/documents/reports; permission va test UI
  van can doi chieu theo danh sach ADM day du.
- Da tich hop `FileReadyRef`, `UserContentRef`, `StatsRegistry`, `AuditService`, `OutboxService`
  va file access policy.
- Upload dung S3-compatible storage va ClamAV adapter, fail-closed; chua co bang chung cau hinh
  ha tang that hoac test picker tren Android/iOS. E2E can MongoDB; lan chay truoc that bai do
  `ECONNREFUSED 127.0.0.1:27017`.

## 2. Thu tu, phu thuoc va trang thai

Trang thai: TODO / DOING / WAITING / DONE. DONE chi khi API, UI (neu ap dung), test va
bang chung chay deu dat; placeholder hoac mock khong tinh.

| Ma | Cong viec | Phu thuoc | Trang thai | Dieu kien nghiem thu |
| --- | --- | --- | --- | --- |
| C01 | Posts/feed, ban nhap, likes/saves | Backend base | DOING | 11 API; owner check; loc category/subject; counter/idempotency; khong lo bai an/nhap cho nguoi khac |
| C02 | Comments thread/moderation | C01 | DOING | 4 API; parent thuoc cung bai va hop le; khong tao/sua tren bai khong cong khai; counter chinh xac |
| C04 | Upload backend va FileReadyRef | Backend base; storage/scanner adapter | DOING | 5 API; owner/purpose/MIME/size/quota/expiry; scan fail-closed; signed/access URL co han |
| C03 | Documents va preview/download access | C04, TaxonomyRef | DOING | 6 API; chi file READY; quyen owner/visibility/status; moderation gate; audit |
| C05 | User reports va evidence | C04, target contracts | DOING | 3 API; target hop le/reportable; duplicate detection; evidence access co quyen; owner history |
| C08 | Notifications va outbox consumer | OutboxService, event contracts | DOING | 4 API; recipient isolation; unread/read/read-all; retry va idempotency |
| C07 | Moderation posts/comments/documents | C01-C04, AuditService, C08 | DOING | 10 API; permission server-side; transition/reason/version checks; audit + notification |
| C06 | Report assignment/decision | C05, moderation ports, AuditService, C08 | DOING | 5 API; eligible assignee; expectedVersion; cross-domain command chi goi owner service; atomic report/audit |
| C09 | App Cong dong/Tai lieu va 20 modal | C01-C05, C08, shared UI/AuthGate | DOING | Feed/editor/comments/saved/docs/reports/notifications goi API that; draft, empty/loading/error, cache/auth gate va tests |
| C10 | Web Admin ADM-16/17/18/19/22/23 | C05-C08, registry/shared UI | DOING | Danh sach/chi tiet/moderation/assignment/decision goi API that; permission gate va tests |
| INT | Tich hop TV1 va ban giao | C03-C10 | DOING | FileReadyRef, UserContentRef (posts/documents/reports), StatsRegistry, AuditService, events/commands; xac nhan luong INT01-04 |

### Thu tu lam viec

1. C01/C02 backend: bao toan thay doi Posts/Comments dang co, hoan tat contract va test,
   dang ky module vao app.
2. C04 upload adapter va API; khong mo READY khi chua co ket qua scan.
3. C03 documents va C05 reports tren upload/file-access contract.
4. C08 notification persistence/API/outbox; sau do noi event tu Posts/Comments/Documents/Reports.
5. C07 moderation; C06 report workflows goi moderation command qua provider cua module owner.
6. C09 App, C10 Web Admin; cuoi cung thuc hien INT va cap nhat bang chung.

Phu thuoc moi thay doi thu tu phai ghi ly do va anh huong tai muc 4.

## 3. Contract va ranh gioi

- Dung envelope, error va Page<T> cua backend hien tai; API lay actor tu IdentityContext.
- Không sao chep users, taxonomy, audit, outbox, stats hoac auth/permission cua TV1/TV2.
- `FileReadyRef` cua TV1 duoc cung cap boi module uploads; `UserContentRef` chi expose posts,
  documents, reports cua TV3; `StatsRegistry` nhan dong gop posts/documents/reports.
- Audit mutation goi `AuditService.record`; notification domain event phat qua OutboxService
  va consumer co the retry ma khong tao thong bao trung.
- Xu ly report chi goi command/moderation service cua owner target; TV3 khong tu sua collection
  places/users/reviews cua TV1/TV2.
- Tat ca URI access file phai co han, khong tra storage key/noi bo; quyen xem evidence va tai
  lieu private phai duoc kiem tra o server moi lan cap access.
- Bao cao phan cong 48 operations; doi chieu endpoint rows khi freeze Swagger va ghi ro sai lech
  neu so dem khac.

## 4. Nhat ky va bang chung

| Ngay | Task | Thay doi | Kiem tra/bang chung | Con cho / buoc tiep theo |
| --- | --- | --- | --- | --- |
| 22/11/2026 | Khao sat TV3 | Doc bao cao phan cong, TV1 plan, backend modules, App tabs va Admin registry. Xac nhan C01/C02 dang la phan code duy nhat cua TV3 va modules chua duoc register. | Backend dependencies ban dau chua cai; `npm install --prefix backend` da cai package. `npm --prefix backend run typecheck` dat. Test e2e chua chay duoc vi MongoDB local `127.0.0.1:27017` khong lang nghe; khong danh dau C01/C02 DONE. | Hoan thien test C01/C02 khi MongoDB san sang; xac nhan storage/scanner truoc C04 |
| 22/11/2026 | C01/C02 | Chuan hoa Post DTO/schema theo report (draft, subjectIds/tags/documentIds, status) va Comment DTO/schema (parentId, replyCount, trang thai PUBLISHED/HIDDEN/DELETED); owner check, feed filter/sort, soft-delete, thread mot cap va counter; dang ky PostsModule/CommentsModule trong AppModule; them `posts-comments.e2e.spec.ts`. | Backend `typecheck` dat sau thay doi. E2E co 5 ca nhung chua execute duoc do MongoDB chua chay. Nhung routes attachment van can C04 truoc khi co the chap nhan file that. | Khong danh dau DONE; chay e2e sau khi MongoDB san sang, sau do lam C04 |
| 22/11/2026 | C03-C10 va INT | Them Files API S3/ClamAV fail-closed, Documents, Reports, Notifications/outbox idempotency, moderation posts/comments va cac trang Web Admin TV3; ket noi UserContentRef/StatsRegistry. Trien khai App feed, likes/saves, sua/xoa bai, comments/replies, reports/evidence/history, notifications, documents va upload picker; validate attachment POST_IMAGE/DOCUMENT o backend. Them policy access URL cho anh bai viet va thong bao cho likes/comments. | `npm run typecheck`, `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix web-admin run build` deu dat. `npm test -- --runInBand`: 7 suites, 109 tests passed; can mock ESM native picker trong `jest.setup.js`. Eslint cac file App TV3 exit 0, 0 errors va 14 canh bao `no-void`. `git diff --check` exit 0 (Git chi canh bao line ending). E2E Files/Posts/Reports chua dat: ket qua truoc do la `ECONNREFUSED 127.0.0.1:27017`; chua test picker tren thiet bi, S3/ClamAV that chua duoc cau hinh. | Tiep tuc giu tat ca hang muc DOING; can MongoDB, storage va scanner that de chay e2e, sau do hoan thien cac modal/permission/test con lai va doi chieu 48 operations |

## 5. Cong viec tiep theo

1. Khoi dong MongoDB test, chay `backend/test/posts-comments.e2e.spec.ts`, `backend/test/files.e2e.spec.ts` va `backend/test/reports-notifications.e2e.spec.ts`; xu ly that bai truoc khi danh dau hang muc DONE.
2. Cau hinh S3-compatible storage va ClamAV trong moi truong test/deploy, xac minh upload bytes, scan va access URL tren Android/iOS; hien tai chi co adapter va cau hinh, chua co bang chung ha tang.
3. Hoan thien doi chieu API 48 operations, cac man hinh/modals TV3 con thieu va test permission Web Admin; cap nhat bang chung theo tung hang muc.
4. Danh gia lai atomicity giua moderation target va report decision, sau do chay lai full build/typecheck/test; khong danh dau DONE chi dua tren compile/UI.
