# Transaver Word: Kế hoạch điều phối

> Cách 3 session Claude cùng làm sản phẩm: ai làm gì, trao đổi ra sao, và orchestrator làm gì giữa các lần giao việc.
>
> **Session orchestrator mới: đọc [orchestrator-handoff.md](orchestrator-handoff.md) trước.**
>
> Ngày soạn: 08/11/2026 · Liên quan: [final-decision-features.md](final-decision-features.md), [database-redesign.html](database-redesign.html), [theme-system.md](theme-system.md)

---

## 1. Phạm vi

**Làm:** 16 chức năng **Phải có** + 11 chức năng **Tốt nếu có** trong [final-decision-features.md](final-decision-features.md).

**Không làm:** 5 chức năng **Để sau** (ảnh minh họa, chia sẻ bộ từ, AI chấm câu, học cùng bạn bè, đổi điểm lấy theme/Premium).

**Để lại cho chủ sản phẩm tự dev** (cần API key bí mật). Code chỉ chừa sẵn interface và biến `.env` để trống:

| Chức năng | Phần làm sẵn |
|---|---|
| Đăng nhập Google | Không làm. Chỉ để sẵn cột `users.google_id` (nullable) |
| Nghĩa theo ngữ cảnh bằng AI | Interface `ContextMeaningService`. Bản tạm: người dùng chọn nghĩa trong từ điển (phương án A) |
| Gửi email (nhắc học, báo cáo tuần) | Mailable + scheduler, `MAIL_MAILER=log` |

**Đăng ký và đăng nhập:** làm thủ công. Người dùng nhập email, mật khẩu và nhập lại mật khẩu. **Không xác nhận email.** Token dùng Laravel Sanctum.

---

## 2. Công nghệ và môi trường

| Phần | Công nghệ | Thư mục | Chạy ở |
|---|---|---|---|
| Backend | Laravel 11, PHP 8.3, **PostgreSQL 16** (Docker, container `transaver-postgres`, cổng 5432), Sanctum | `backend/` | `http://localhost:8000` |
| Web app | React 18 + TypeScript + Vite, React Router, TanStack Query, CSS Modules | `web/` | `http://localhost:5173` |
| Extension | JavaScript thuần, Chrome MV3 (giữ như hiện tại) | `extension/` | Load unpacked |

- Máy đã có: PHP 8.3.6, Composer 2.7, Node 22, npm 10, Docker (không cần sudo). **Database: PostgreSQL** (chủ sản phẩm chọn 08/11/2026), chạy bằng Docker; driver `php8.3-pgsql` do chủ sản phẩm cài bằng sudo.
- **Không có Redis**, nên cache, queue và rate limiter dùng driver `database`.
- Màu và font lấy từ [brand/themes/themes.css](../brand/themes/themes.css). Không viết mã màu trực tiếp. MVP chỉ bật theme `teal`, kèm sáng/tối theo hệ điều hành.
- Extension **không có form đăng nhập** (chủ sản phẩm đổi 08/11/2026). Extension dùng chung phiên với web app: content script `extension/src/web-bridge.js` chạy trên `localhost`/`127.0.0.1` (mọi cổng), chỉ hoạt động khi trang có `<meta name="transaver-web-app">`, đọc token web trong `localStorage`, background kiểm tra bằng `GET /me` rồi lưu. Web đăng xuất thì extension cũng đăng xuất. **Khi lên production:** giới hạn bridge vào đúng domain web app.

---

## 3. Vai trò

| Session | Vai trò | Được sửa | Không được sửa |
|---|---|---|---|
| **transaver-word-62** (orchestrator) | Viết hợp đồng API, giao việc, chuyển tin giữa FE và BE, kiểm tra kết quả, báo chủ sản phẩm | `docs/` | `backend/`, `web/`, `extension/` (chỉ đọc và chạy thử) |
| **Back-end** | Code Laravel, migration, test PHP | `backend/` | Mọi thứ ngoài `backend/` |
| **Front-end** | Code web app và extension | `web/`, `extension/` | Mọi thứ ngoài hai thư mục này |

- **Không session nào tự commit.** Orchestrator đề xuất commit khi xong mỗi giai đoạn, chủ sản phẩm quyết định.
- Cả 3 session dùng chung một thư mục repo. Chia thư mục như trên nên không ghi đè nhau.

---

## 4. Cách trao đổi: mọi thứ đi qua orchestrator

```
            ┌──────────────── Chủ sản phẩm ────────────────┐
            │      (duyệt kế hoạch, trả lời câu hỏi,        │
            │       nghiệm thu cuối mỗi giai đoạn)          │
            └──────────────────────┬────────────────────────┘
                                   │
                       ┌───────────▼───────────┐
                       │     Orchestrator      │
                       │  docs/api-contract.md │◄── nguồn sự thật duy nhất
                       └─────┬───────────▲─────┘
                 giao việc   │           │  báo cáo / hỏi
             ┌───────────────┘           └───────────────┐
             ▼                                           ▼
       ┌───────────┐     KHÔNG nhắn trực tiếp      ┌───────────┐
       │ Front-end │  ◄─────────── ✕ ───────────►  │ Back-end  │
       └───────────┘                               └───────────┘
```

**Quy tắc:**

1. **FE và BE không nhắn trực tiếp cho nhau.** Mọi câu hỏi và thay đổi đều gửi về orchestrator.
2. **[api-contract.md](api-contract.md) là nguồn sự thật duy nhất.** Chỉ orchestrator được sửa file này. Khi sửa, orchestrator ghi lại thay đổi ở cuối file (mục "Lịch sử thay đổi") và báo cho **cả hai bên**.
3. **Câu hỏi về nghiệp vụ** (ví dụ "thẻ đóng băng được mấy cái") thì orchestrator tra trong `docs/`. Tài liệu không có thì orchestrator hỏi chủ sản phẩm, không tự quyết.
4. **Câu hỏi kỹ thuật giữa hai bên** (ví dụ "trường này null được không") thì orchestrator trả lời theo contract. Nếu contract thiếu, orchestrator bổ sung rồi báo cả hai bên.
5. **Front-end cần chủ sản phẩm duyệt từng tin nhắn** vì chạy ở chế độ quyền khác. Mỗi lần giao việc cho Front-end, orchestrator sẽ nhắc chủ sản phẩm bấm duyệt.

### Mẫu tin giao việc (orchestrator → FE/BE)

```
[TASK BE-2.1] Lưu từ và ngữ cảnh
Mục tiêu: …
Đọc trước: docs/api-contract.md mục 3; docs/database-redesign.html mục "Luồng lưu từ"
Được sửa: backend/
Tiêu chí xong:
  - POST /api/words đúng contract mục 3.1
  - Gửi cùng câu 2 lần không tạo dòng trùng
  - php artisan test xanh
Khi xong: SendMessage tới "transaver-word-62" theo mẫu báo cáo.
Gặp chỗ contract không rõ: dừng phần đó, hỏi orchestrator, làm tiếp phần khác.
```

### Mẫu báo cáo (FE/BE → orchestrator)

```
[DONE BE-2.1]  (hoặc [BLOCKED …] / [QUESTION …])
Đã làm: …
File chính: …
Cách chạy thử: …
Test: N passed / M failed
Lệch contract (nếu có): …
Câu hỏi: …
```

---

## 5. Orchestrator làm gì giữa các lần giao việc

Mỗi giai đoạn lặp lại vòng sau:

| Bước | Orchestrator làm | Chờ ai |
|---|---|---|
| 1. Chuẩn bị | Viết hoặc bổ sung phần contract cho giai đoạn này. Tách việc thành task có tiêu chí xong rõ ràng | — |
| 2. Giao việc | Gửi task cho BE và FE cùng lúc. Đăng ký nhận thông báo khi mỗi bên rảnh (`notify_when_idle`) | Chủ sản phẩm duyệt tin cho FE |
| 3. Trong lúc hai bên làm | Trả lời câu hỏi `[QUESTION]`. Chuyển thay đổi contract cho bên kia. Chuẩn bị task của giai đoạn sau. **Không sửa code của hai bên** | — |
| 4. Nhận báo cáo | Đọc code thay đổi (`git status`, `git diff`). Đối chiếu với contract và tài liệu | — |
| 5. Kiểm tra | BE: chạy `php artisan test`, gọi thử API bằng `curl`. FE: chạy `npm run build`, `npm run typecheck`, `npm run lint`. Ghép thật: web gọi backend thật thay cho mock | — |
| 6. Phản hồi | Có lỗi thì gửi task sửa `[FIX …]` kèm bước tái hiện, quay lại bước 3. Không lỗi thì sang bước 7 | — |
| 7. Báo chủ sản phẩm | Tóm tắt: đã xong gì, cách xem thử, việc còn lại, câu hỏi cần quyết. Đề xuất commit | **Chủ sản phẩm nghiệm thu** |

- Orchestrator **không chờ suông.** Hai bên làm song song, giai đoạn sau chỉ bắt đầu khi giai đoạn trước đã ghép xong và được chủ sản phẩm đồng ý.
- **Front-end làm trước với mock** (MSW theo contract) nên không phải chờ backend. Ghép với backend thật ở bước 5.
- Một bên xong sớm thì orchestrator giao thêm việc không phụ thuộc bên kia, ví dụ viết test hoặc làm sẵn task của giai đoạn sau nếu task đó không đụng contract chưa chốt.

---

### 5.1. Chế độ làm liền (chủ sản phẩm chốt 08/11/2026)

- **"Xong" nghĩa là xong toàn bộ** 16 Phải có + 11 Tốt nếu có (trừ nhóm Để sau). Hai bên làm liền từ giai đoạn hiện tại tới giai đoạn 6, **không dừng chờ** nghiệm thu giữa các giai đoạn.
- Hết mỗi giai đoạn: gửi `[PHASE-DONE BE-n]` / `[PHASE-DONE FE-n]` cho orchestrator rồi **làm tiếp ngay**. Orchestrator kiểm tra song song; có lỗi thì gửi `[FIX …]`, ưu tiên sửa trước khi làm tiếp.
- Xong hết: `[DONE-ALL BE]` / `[DONE-ALL FE]`. Sau đó orchestrator làm giai đoạn 7 (ghép toàn bộ, nghiệm thu) rồi mới báo chủ sản phẩm.
- Contract đã viết đủ cho giai đoạn 1–6 (v0.3), nên Front-end làm trước bằng mock, không phải chờ Back-end.

## 6. Các giai đoạn

### Giai đoạn 0: Orchestrator chuẩn bị

- [x] Viết `docs/api-contract.md` cho giai đoạn 1–2: quy ước chung, auth, words, contexts, dictionary.
- [x] Viết quy ước: định dạng lỗi, phân trang, ngày giờ (ISO 8601 UTC + `timezone` của người dùng), cách đặt tên.
- [x] Gửi việc giai đoạn 1.

### Giai đoạn 1: Nền tảng + đăng ký/đăng nhập

| Back-end | Front-end |
|---|---|
| Tạo dự án Laravel 11 trong `backend/`, kết nối PostgreSQL `transaver` | Tạo dự án Vite + React + TS trong `web/`, ESLint, Prettier |
| Migration đủ 15 bảng theo `database-redesign.html` (cột Google để nullable) | Nạp `themes.css` + font, layout chung, router |
| `POST /api/auth/register` (email, password, password_confirmation), `login`, `logout`, `GET /api/me` | Trang Đăng ký, Đăng nhập. Lưu token, chặn trang cần đăng nhập |
| Tạo `user_settings` và `user_progress` mặc định khi đăng ký | API client + MSW mock theo contract |
| CORS cho `localhost:5173` và extension. Seeder có 1 tài khoản mẫu | Extension: dùng chung phiên đăng nhập với web (ban đầu là form trong popup, đã bỏ) |

### Giai đoạn 2: Lưu từ và quản lý từ

| Back-end | Front-end |
|---|---|
| `POST /api/words`: chuẩn hóa từ, tra Free Dictionary API, chống trùng bằng `sentence_hash` | Extension: nút **Lưu** trong khung dịch, lấy câu chứa từ, tiêu đề và link trang |
| Chọn nghĩa cho ngữ cảnh (phương án A) | Extension: sau khi lưu, hiện danh sách nghĩa để chọn |
| Danh sách từ: tìm, sửa, xóa mềm, thùng rác, khôi phục, đánh dấu "đã biết" | Web: trang Từ của tôi (tìm, sửa, xóa, hoàn tác), trang Thùng rác, chi tiết từ với nhiều câu ngữ cảnh |
| Lưu cụm từ, thành ngữ (`user_words.kind`) | Phát âm (audio từ từ điển) |

### Giai đoạn 3: Ôn tập (cốt lõi)

| Back-end | Front-end |
|---|---|
| FSRS ở server: port lõi `ts-fsrs` sang PHP, kèm test so kết quả với `ts-fsrs` | Màn hình buổi ôn: tiến độ, hết bài |
| `GET /api/review/queue`, `POST /api/review/answer` (chống trùng bằng `client_uuid`) | Flashcard **4 nút** (Quên / Khó / Được / Dễ), hiện khoảng cách lần ôn tiếp trên nút |
| Chọn câu cho bài điền chỗ trống, sinh 3 đáp án nhiễu cho trắc nghiệm | Trắc nghiệm 4 đáp án |
| `review_sessions`, `daily_activity`, streak + thẻ đóng băng (theo múi giờ người dùng) | **Điền chỗ trống bằng câu gốc** |

### Giai đoạn 4: Cá nhân hóa, nhắc học, thống kê, quyền riêng tư

| Back-end | Front-end |
|---|---|
| `GET/PUT /api/settings`, lưu onboarding | Onboarding 3 câu hỏi (hiện sau khi đăng ký) |
| Thống kê cơ bản: đã lưu, đã thuộc, cần ôn hôm nay | Trang chủ: thống kê, streak, nút "Ôn ngay" |
| Scheduler nhắc học qua email (driver `log`), `notification_logs` | Trang Cài đặt: mục tiêu ngày, giờ nhắc, kênh nhắc |
| `GET /api/today` (hôm nay đã học chưa) cho extension | Extension: nhắc học bằng `chrome.alarms` + thông báo trình duyệt |
| `DELETE /api/account` | Trang Quyền riêng tư, nút Xóa tài khoản |

### Giai đoạn 5: Tốt nếu có, phần học

| Back-end | Front-end |
|---|---|
| Deck: CRUD, thêm/bớt từ, ôn theo deck | Quản lý deck trên web (extension không hỏi deck) |
| Ôn riêng từ khó (`lapses >= 3`) | Dạng bài **Nghe** (nghe rồi chọn nghĩa) và **Gõ chính tả** |
| Chống dồn ứ (`daily_review_limit`, ngưng từ mới khi quá tải) | Chế độ ôn từ khó, ôn theo deck |
| `desired_retention`, `card_display` trong settings | Cài đặt mức ghi nhớ và thông tin hiện trên thẻ |

### Giai đoạn 6: Tốt nếu có, động lực và vận hành

| Back-end | Front-end |
|---|---|
| XP, cấp độ, huy hiệu (`achievements` + seeder) | Hiện XP, cấp độ, huy hiệu. Thông báo khi đạt huy hiệu |
| Báo cáo tuần: API + email (driver `log`) | Trang Báo cáo tuần |
| API heatmap và biểu đồ tiến bộ | Heatmap kiểu GitHub, biểu đồ tiến bộ |
| `GET /api/words/highlight-list` | Extension: **highlight từ đã lưu** khi lướt web, di chuột để tự kiểm tra |
| Trang admin cơ bản (API có middleware `role=admin`) | Trang admin trong web app |

### Giai đoạn 7: Ghép toàn bộ và nghiệm thu

- [x] Orchestrator chạy toàn bộ luồng: đăng ký → onboarding → lưu từ trên extension → ôn trên web → streak → thống kê.
- [x] Đối chiếu 27 chức năng với [final-decision-features.md](final-decision-features.md), đánh dấu đã xong.
- [x] Viết `README.md` hướng dẫn chạy cả 3 phần.
- [x] Liệt kê chỗ để trống cho chủ sản phẩm (Google, AI, email) và cách gắn vào.

---

## 7. Điểm dừng chờ chủ sản phẩm

Orchestrator sẽ dừng và hỏi ở những lúc sau:

- Cuối mỗi giai đoạn: nghiệm thu, quyết định commit.
- Khi tài liệu không trả lời được một câu hỏi nghiệp vụ.
- Mỗi lần gửi tin cho Front-end: nhắc chủ sản phẩm duyệt tin.
- Khi một bên báo `[BLOCKED]` vì cần quyền hoặc công cụ mà session đó không có.

## 8. Mặc định đã chọn (sửa được)

| Vấn đề | Đang chọn |
|---|---|
| Nút đánh giá flashcard | 4 nút: Quên / Khó / Được / Dễ |
| Ngôn ngữ MVP | Anh → Việt. Database vẫn lưu cặp ngôn ngữ |
| FSRS | Tính ở server (PHP), port từ `ts-fsrs` |
| Thẻ đóng băng | Được 1 thẻ sau mỗi 7 ngày liên tiếp, giữ tối đa 2 |
| Thùng rác | Tự xóa hẳn sau 30 ngày |
| Mật khẩu | Tối thiểu 8 ký tự. Không xác nhận email, không quên mật khẩu (cần gửi mail) |
| Extension mất mạng khi bấm Lưu | Báo lỗi, người dùng bấm lại |
