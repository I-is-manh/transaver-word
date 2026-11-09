# Transaver Word: Bàn giao cho orchestrator

> Đọc file này **đầu tiên** khi mở một session orchestrator mới. Nó tóm tắt mọi thứ đã làm và cách điều phối tiếp, để không phải bắt đầu lại.
>
> Cập nhật lần cuối: 09/11/2026. Session orchestrator gần nhất: `transaver-word-94` (trước đó `transaver-word-62`).

---

## 1. Bắt đầu nhanh (orchestrator mới làm theo thứ tự)

1. Đọc file này, rồi [orchestration-plan.md](orchestration-plan.md) (vai trò, quy tắc trao đổi, mẫu tin) và mục 11 "Lịch sử thay đổi" của [api-contract.md](api-contract.md).
2. Gọi `ListAgents` để xem các session đang mở. Tên hiện tại: **Front-end**, **Back-end** (chủ sản phẩm đặt tên; nếu mở session mới thì hỏi tên).
3. Nhắn mỗi session một tin giới thiệu: orchestrator mới tên gì, báo cáo gửi về đâu (`SendMessage` tới tên session orchestrator mới).
4. Kiểm tra môi trường còn chạy (mục 4), rồi hỏi chủ sản phẩm việc tiếp theo.

---

## 2. Trạng thái hiện tại

**Đã xong toàn bộ phạm vi:** 16 Phải có + 11 Tốt nếu có (xem [acceptance.md](acceptance.md)), cộng 3 chức năng thêm sau nghiệm thu:

- Superadmin "Đăng nhập với tư cách" + "Quay lại tài khoản của tôi" + nhật ký (contract 9.1).
- Nút giao diện Hệ thống / Sáng / Tối, đồng bộ web ↔ extension qua `settings.appearance` (contract 6.4).
- Extension dùng chung phiên đăng nhập với web qua `extension/src/web-bridge.js` (bỏ form đăng nhập trong popup).

**Số liệu lần kiểm tra cuối:** backend 198/198 test đạt (có `RealDataSmokeTest` chạy trên dữ liệu demo); web typecheck, lint, build sạch; `node --check` mọi file JS extension sạch; luồng API end-to-end 37/37 bước đạt; mọi trang web render trên Chrome headless với backend thật, 0 lỗi.

**Contract:** [api-contract.md](api-contract.md) **v0.17**.

**Git:** **chưa commit gì** từ đầu dự án tới giờ (nhánh `dev/vansmanh`). `backend/`, `web/`, nhiều file `docs/`, `brand/themes/` đều untracked; `extension/` và `README.md` đã sửa. Chỉ commit khi chủ sản phẩm bảo.

**Làm thêm 09/11/2026 (orchestrator tự làm, lúc không có session FE/BE):** đăng nhập Google (contract 2.6), xác minh email + email qua queue (2.7), thiết kế lại email xác nhận (`resources/views/mail/layout.blade.php` dùng chung), đổi favicon web và icon extension sang logo dấu trang. Sửa từ trong "Từ của tôi" đã xong (BE-11 + FE-10, contract 3.7 v0.16); web không còn tô vàng từ trong câu (chỉ in đậm teal, `MarkedSentence`), để không lẫn với highlight của extension. Gom nhóm "Từ của tôi" theo ngôn ngữ + thời gian đã xong (BE-12 + FE-12, contract 3.11 v0.17). Hành động mỗi dòng là nút icon (`IconButton`, `UiIcon`), nút chọn một dùng chung `Segmented`. **Không có việc dở dang.** Còn chờ chủ sản phẩm: hiện lại tên deck dưới dạng chip trong danh sách từ? làm ảnh minh họa từ Pexels? `FIX BE-10` đã xong (09/11/2026, orchestrator tự sửa vì lúc đó không có session Back-end, chủ sản phẩm đồng ý): `CardBuilder::contextsByWord()` dùng `selectRaw(… AS last_used)` thay cho `pluck(DB::raw('MAX(reviewed_at)'))`. Đã rà toàn backend, không còn chỗ nào dùng biểu thức không alias. Tạo buổi ôn `daily`/`hard`/`deck` với `demo` đều 201.

---

## 3. Quyết định đã chốt (đừng hỏi lại)

| Vấn đề | Đã chốt |
|---|---|
| Phạm vi | 16 Phải có + 11 Tốt nếu có. Nhóm "Để sau" (ảnh minh họa, chia sẻ bộ từ, AI chấm câu, bạn bè/bảng xếp hạng, đổi điểm lấy theme/Premium) **không làm** |
| Stack | Backend **Laravel 12** + **PostgreSQL 16** (Docker) + Sanctum. Web **React 18 + TypeScript + Vite**, React Router, TanStack Query, CSS Modules. Extension **JavaScript thuần**, MV3 |
| Đăng nhập | Email + mật khẩu + nhập lại mật khẩu, **không xác nhận email**, không quên mật khẩu. **Đăng nhập Google đã làm** (09/11/2026, contract 2.6): redirect Socialite + mã một lần, chủ sản phẩm tự cấu hình `GOOGLE_*` |
| Phần cần khóa bí mật | **Chủ sản phẩm tự dev**: AI nghĩa theo ngữ cảnh (`App\Contracts\ContextMeaningService`), gửi email thật (`MAIL_MAILER=log`). Chỉ chừa interface và biến `.env` trống |
| Vai trò | `user` · `admin` · `superadmin` (superadmin = chủ sản phẩm) |
| Flashcard | 4 nút: Quên / Khó / Được / Dễ |
| FSRS | Tính ở server, port từ ts-fsrs 5.2.3 (`backend/app/Fsrs`) |
| Ngôn ngữ MVP | Anh → Việt (schema lưu sẵn cặp ngôn ngữ) |
| Theme | Chỉ `teal`. Hệ thống 15 theme đã thiết kế ([theme-system.md](theme-system.md)), **chưa dev** |
| Mobile | Không làm responsive mobile, chỉ máy tính |
| Không có Redis | Cache, queue, session, rate limiter dùng driver `database` |

---

## 4. Môi trường local

| Thành phần | Chạy ở | Ghi chú |
|---|---|---|
| PostgreSQL 16 | Docker container `transaver-postgres`, `127.0.0.1:5432`, volume `transaver-pgdata` | DB `transaver` + `transaver_test`. Mật khẩu trong `backend/.env`. **Đừng đụng** các container khác trên máy (vaultwarden, manulife-*) |
| Backend | `cd backend && php artisan serve` → `http://localhost:8000` | Đặt `export XDEBUG_MODE=off` để tắt cảnh báo Xdebug. **Queue worker gửi email (bắt buộc):** `php artisan queue:work --tries=3` ở terminal riêng; mọi Mailable đều `ShouldQueue`, không gửi trong request hay scheduler (chủ sản phẩm chốt 09/11/2026). Scheduler: `php artisan schedule:work` |
| Web | `cd web && VITE_USE_MOCKS=false npm run dev` → `http://localhost:5173` | Bỏ `VITE_USE_MOCKS=false` để dùng mock MSW |
| Extension | `chrome://extensions` → Load unpacked → `extension/` | Đăng nhập trên web là extension tự nhận phiên |

**Tài khoản (backend thật, mật khẩu `password123`):** `demo@transaver.local` (có dữ liệu học mẫu ~60 từ, 45 ngày), `admin@transaver.local`, `superadmin@transaver.local`.
**Tài khoản mock (mật khẩu `matkhau123`):** `demo@`, `admin@`, `superadmin@transaver.vn`.

Kiểm tra nhanh:

```bash
curl -s localhost:8000/api/health                          # {"ok":true}
cd backend && XDEBUG_MODE=off php artisan test              # 160 passed
cd web && npm run typecheck && npm run lint && npm run build
for f in extension/src/*.js extension/popup/*.js; do node --check $f; done
```

Dữ liệu demo bị hỏng thì: `php artisan db:seed --class=DemoDataSeeder` (chỉ sinh lại dữ liệu học của tài khoản demo). **Đừng** `migrate:fresh` khi đang có người thử trên DB dev.

---

## 5. Cách điều phối đã dùng (giữ nguyên)

- **Mọi trao đổi đi qua orchestrator.** Front-end và Back-end không nhắn trực tiếp cho nhau. Chỉ orchestrator sửa `docs/` (gồm `api-contract.md`).
- **Thư mục riêng:** Back-end chỉ sửa `backend/`; Front-end chỉ sửa `web/` và `extension/`.
- **Mẫu tin:** `[TASK X-n]`, `[FIX X-n.m]`, `[REVIEW …]`, `[INFO …]`. Báo cáo về: `[DONE …]`, `[PHASE-DONE …]`, `[DONE-ALL …]`, `[BLOCKED …]`, `[QUESTION …]`. Số task đã dùng tới **BE-12** và **FE-12**; việc mới đánh số từ **BE-13 / FE-13**.
- **Mỗi lần nhận `[DONE]`:** orchestrator tự chạy lại test/build và gọi API thật (curl, hoặc script Python), xem diff khi cần, rồi mới chấp nhận. Giả định hợp lý của hai bên thì ghi vào contract (tăng phiên bản, thêm dòng ở mục 11).
- **Dùng `notify_when_idle: true`** khi giao việc để biết lúc session xong lượt. Thông báo idle thường đến **sau** báo cáo, hoặc là của lượt cũ: kiểm tra `ListAgents` hoặc code trước khi kết luận.
- **Front-end chạy ở chế độ quyền khác**: mỗi tin gửi Front-end phải **chờ chủ sản phẩm duyệt** ở cửa sổ Front-end. Luôn nhắc chủ sản phẩm khi gửi tin cho Front-end, và gộp nhiều nội dung vào một tin để đỡ phải duyệt. Back-end nhận tin thẳng.
- Thông báo đẩy về điện thoại chỉ đi được khi chủ sản phẩm bật `/remote-control`. Không gửi được email.
- Chủ sản phẩm đôi khi giao việc **trực tiếp** cho Front-end/Back-end. Khi nhận báo cáo có thay đổi ngoài contract, cập nhật tài liệu cho khớp.

### Công cụ kiểm tra giao diện

Playwright cài trong scratchpad của session cũ (không còn ở session mới). Cài lại: tạo thư mục trong scratchpad, `npm i playwright-core@1.48.2`, chạy với `executablePath: '/usr/bin/google-chrome'`. Chạy web riêng cho việc kiểm tra ở cổng khác (ví dụ `VITE_USE_MOCKS=false npx vite --port 5181 --strictPort`) rồi tắt sau khi xong. Backend cho phép CORS mọi cổng `localhost` ở môi trường local.

---

## 6. Bài học (tránh lặp lại)

- Trước đây backend chỉ cho CORS `localhost:5173`, web chạy cổng khác bị "Không kết nối được máy chủ". Đã sửa: local cho mọi cổng.
- Vite có thể cache bản rỗng khi đọc đúng lúc file đang bị ghi đè ("does not provide an export named …"). Cách xử lý: tải lại trang (Ctrl+Shift+R) hoặc khởi động lại dev server. Front-end đã chuyển sang ghi file kiểu atomic.
- `migrate:fresh` xóa dữ liệu người khác đang thử. Thay đổi schema sau giai đoạn đầu phải viết **migration mới**.
- Test rỗng không bắt được lỗi chỉ xuất hiện khi có dữ liệu (ví dụ BE-10). Khi kiểm tra, luôn gọi thử trên tài khoản demo có dữ liệu thật, không chỉ trên tài khoản mới.
- Gửi ký tự có dấu trong URL bằng script: nhớ `urllib.parse.quote`. Tài khoản thử tạo ra phải xóa (`DELETE /account`) sau khi chạy.

---

## 7. Việc còn mở

- [ ] Chủ sản phẩm quyết định commit (chưa có gì được commit).
- [ ] Chủ sản phẩm tự thử extension trên Chrome thật.
- [ ] Chủ sản phẩm tự thử đăng nhập Google thật (màn hình đồng ý của Google không tự động hóa được; orchestrator đã thử phần còn lại).
- [ ] Chủ sản phẩm tự gắn: AI nghĩa theo ngữ cảnh, gửi email thật ([README.md](../README.md)).
- [ ] Khi lên production: giới hạn `web-bridge.js` vào đúng domain web app; đặt `FRONTEND_URL` cho CORS.
- [ ] Extension còn viết màu teal trực tiếp, chưa dùng `themes.css` (làm khi dev hệ thống theme).
- [ ] Hành vi cần chủ sản phẩm xác nhận nếu thấy lạ: chọn sáng/tối khi chưa đăng nhập, rồi đăng nhập vào tài khoản đang lưu "Hệ thống" → giá trị server thắng.

---

## 8. Bản đồ tài liệu

| File | Dùng khi |
|---|---|
| [orchestration-plan.md](orchestration-plan.md) | Vai trò, quy tắc, các giai đoạn đã làm |
| [api-contract.md](api-contract.md) | Mọi endpoint và quy ước (v0.11) |
| [acceptance.md](acceptance.md) | Chức năng nào ở đâu, kiểm tra thế nào |
| [database-redesign.html](database-redesign.html) | Thiết kế database (migration thật trong `backend/database/migrations` là nguồn đúng) |
| [final-decision-features.md](final-decision-features.md) | 32 chức năng đã chốt |
| [product-plan.md](product-plan.md) | Định hướng sản phẩm |
| [theme-system.md](theme-system.md) | Hệ thống theme (chưa dev) |
| `backend/README.md`, `web/README.md`, `extension/README.md` | Cách chạy từng phần |
