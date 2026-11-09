# Transaver Word: Hợp đồng API

> **Nguồn sự thật duy nhất** giữa Back-end (`backend/`) và Front-end (`web/`, `extension/`). Chỉ orchestrator sửa file này. Thấy chỗ thiếu hoặc mâu thuẫn: gửi `[QUESTION]` cho orchestrator, không tự đoán.
>
> Phiên bản: **v0.17** (09/11/2026) · Phạm vi: **toàn bộ** 16 chức năng Phải có + 11 chức năng Tốt nếu có (giai đoạn 1–6).
>
> Liên quan: [orchestration-plan.md](orchestration-plan.md), [database-redesign.html](database-redesign.html)

---

## 1. Quy ước chung

### 1.1. Địa chỉ và header

- Base URL (local): `http://localhost:8000/api`
- Mọi request gửi `Accept: application/json`. Request có body gửi `Content-Type: application/json`.
- Endpoint cần đăng nhập gửi `Authorization: Bearer <token>` (Sanctum personal access token). Thiếu hoặc sai token → `401`.
- Web app đọc base URL từ `VITE_API_BASE_URL`. Extension để trong một hằng số `API_BASE_URL` ở một file cấu hình duy nhất.

### 1.2. CORS

- Cho phép origin `http://localhost:5173`.
- Extension gọi API từ **service worker** (`background.js`), có `host_permissions` cho `http://localhost:8000/*`, nên không vướng CORS. Content script **không** gọi API trực tiếp mà gửi message cho background.

### 1.3. Kiểu dữ liệu

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Thời điểm | ISO 8601, UTC, có `Z` | `"2026-11-08T14:03:00Z"` |
| Ngày học (theo múi giờ người dùng) | `YYYY-MM-DD` | `"2026-11-08"` |
| Múi giờ | Tên IANA | `"Asia/Ho_Chi_Minh"` |
| ID | Số nguyên | `42` |
| Tên trường JSON | `snake_case` | `page_url` |
| Không có giá trị | `null` (luôn có mặt trường, không bỏ trường) | `"phonetic": null` |

### 1.4. Lỗi

Dùng đúng định dạng mặc định của Laravel:

```json
// 422 lỗi dữ liệu
{
  "message": "Email đã được sử dụng.",
  "errors": { "email": ["Email đã được sử dụng."] }
}

// 401, 403, 404, 409, 429, 500
{ "message": "Không tìm thấy." }
```

- Câu thông báo bằng **tiếng Việt** (đặt `APP_LOCALE=vi`, có file `lang/vi/validation.php`), kể cả phần đuôi "(và N lỗi khác)" khi có nhiều lỗi. FE hiện thẳng `message` hoặc `errors[field][0]` cạnh ô nhập.
- JSON trả về dạng **UTF-8 thô** (không escape `\uXXXX`), để dễ đọc khi debug.
- `429`: quá giới hạn lượt (rate limit). Có header `Retry-After`.

### 1.5. Phân trang

Dùng phân trang mặc định của Laravel API Resource. FE chỉ dựa vào `data` và `meta`:

```json
{
  "data": [ /* ... */ ],
  "links": { "first": "...", "last": "...", "prev": null, "next": "..." },
  "meta": { "current_page": 1, "last_page": 5, "per_page": 20, "total": 93 }
}
```

Tham số: `page` (mặc định 1), `per_page` (mặc định 20, tối đa 100).

### 1.6. Object đơn lẻ

Response trả **một object** thì bọc trong khóa có tên, không bọc `data`. Ví dụ `{ "user": {...} }`, `{ "word": {...} }`.

### 1.7. Kiểm tra sống

`GET /api/health` → `200 { "ok": true }` (không cần đăng nhập).

---

## 2. Auth

Đăng ký thủ công bằng email và mật khẩu (**không xác nhận email, không quên mật khẩu**), hoặc đăng nhập bằng Google (mục 2.6).

### 2.1. Object `User`

```json
{
  "id": 1,
  "email": "manh@example.com",
  "name": null,
  "role": "user",                    // "user" | "admin" | "superadmin"
  "has_password": true,              // false: tài khoản tạo bằng Google, không có mật khẩu (mục 2.6)
  "email_verified": true,            // mục 2.7
  "impersonator": null,              // mục 9.1
  "timezone": "Asia/Ho_Chi_Minh",
  "onboarding_completed": false,
  "created_at": "2026-11-08T14:03:00Z"
}
```

### 2.2. `POST /api/auth/register`

```json
// request
{
  "email": "manh@example.com",
  "password": "matkhau123",
  "password_confirmation": "matkhau123",
  "timezone": "Asia/Ho_Chi_Minh",     // tùy chọn, FE gửi Intl.DateTimeFormat().resolvedOptions().timeZone
  "device_name": "web"                // tùy chọn: "web" | "extension", mặc định "web"
}
```

- Kiểm tra: `email` bắt buộc, đúng định dạng, tối đa 255, chưa tồn tại (không phân biệt hoa thường; lưu dạng chữ thường). `password` tối thiểu 8 ký tự, tối đa 72, phải khớp `password_confirmation`. `timezone` nếu có phải là múi giờ IANA hợp lệ, không có thì dùng `Asia/Ho_Chi_Minh`.
- Tạo kèm `user_settings` (giá trị mặc định) và `user_progress`.
- `201`:

```json
{ "token": "1|abc...", "user": { /* User */ } }
```

### 2.3. `POST /api/auth/login`

```json
// request
{ "email": "manh@example.com", "password": "matkhau123", "device_name": "extension" }
```

- Sai email hoặc mật khẩu → `422`, lỗi gắn ở `errors.email`: `"Email hoặc mật khẩu không đúng."` (không tiết lộ email có tồn tại hay không).
- Giới hạn 5 lần sai mỗi phút theo email + IP → `429`.
- Tài khoản bị khóa (admin khóa, giai đoạn 6) → `403 { "message": "Tài khoản này đã bị khóa." }`. Token cũ của tài khoản bị khóa cũng trả `403` ở mọi endpoint 🔒.
- `200`: `{ "token": "...", "user": { /* User */ } }`

### 2.4. `POST /api/auth/logout` 🔒

Thu hồi token đang dùng. `204`.

### 2.5. `GET /api/me` 🔒

`200 { "user": { /* User */ } }`

> 🔒 = cần `Authorization: Bearer`.

### 2.6. Đăng nhập bằng Google

Luồng redirect (Laravel Socialite, stateless). Token **không bao giờ** nằm trên URL: backend chỉ gửi về web một mã dùng một lần.

1. Web mở `GET http://localhost:8000/auth/google/redirect` (route web, không có tiền tố `/api`) → backend chuyển sang Google.
2. Google quay về `GOOGLE_REDIRECT_URI` = `http://localhost:8000/auth/google/callback` (phải khai báo trong Google Cloud Console → Authorized redirect URIs).
3. Backend tìm user theo `google_id`; không có thì theo email (không phân biệt hoa thường) và **liên kết** `google_id`; không có nữa thì **tạo tài khoản mới** (mật khẩu ngẫu nhiên, `name` lấy từ Google, cài đặt mặc định, chưa onboarding). Email Google chưa xác minh → từ chối.
4. Backend chuyển về `FRONTEND_URL/auth/google/callback?code=<64 ký tự>`, hoặc `?error=cancelled | failed | email_unverified | banned | not_configured`.
5. Web gọi `POST /api/auth/google/exchange`:

```json
// request
{ "code": "…64 ký tự…", "timezone": "Asia/Ho_Chi_Minh", "device_name": "web" }
// 200
{ "token": "…", "user": { /* User */ }, "created": true }
```

- Mã sống **120 giây**, dùng **một lần**. Sai hoặc hết hạn → `422 errors.code`. Tài khoản bị khóa → `403`. Giới hạn 20 lần/phút.
- `timezone` chỉ áp dụng cho tài khoản vừa tạo.
- Tài khoản tạo qua Google **không có mật khẩu** (`users.password = null`, `User.has_password = false`), chỉ đăng nhập bằng Google; xóa tài khoản bằng cách nhập lại email (mục 6.2).
- Extension không cần làm gì: đăng nhập Google trên web thì extension tự nhận phiên qua `web-bridge.js`.

### 2.7. Xác minh email

Chủ sản phẩm chốt 09/11/2026: **chưa xác minh vẫn dùng app bình thường**, web hiện thanh nhắc.

- `User.email_verified` (bool). Đăng ký bằng email/mật khẩu → `false` và gửi email xác nhận. Đăng nhập Google (mục 2.6) → `true` (Google đã xác minh). Tài khoản có trước tính năng này và tài khoản seeder → `true`.
- **Email đi qua queue** (mọi Mailable đều `ShouldQueue`): request chỉ đẩy job vào bảng `jobs`, queue worker chạy riêng (`php artisan queue:work`) gửi đi. Đăng ký không chờ SMTP.
- Nút trong email mở `GET http://localhost:8000/email/verify/{id}/{hash}?expires=…&signature=…` (URL có chữ ký, **hết hạn sau 24 giờ** — `config/learning.php` → `email_verify_hours`, không cần đăng nhập nên mở được trên máy khác). Backend chuyển về `FRONTEND_URL/email-verified?status=success | already | expired | invalid`.
- `POST /api/email/verification-notification` 🔒 (chặn khi đang impersonate): gửi lại email. `202 { "message", "sent": true }`; đã xác minh → `200 { "message", "sent": false }`; quá 1 lần/phút → `429` + `Retry-After`; không đưa được vào hàng đợi → `503`.
- **Web:** thanh nhắc đầu nội dung (mọi trang trong `AppLayout`) "Hãy xác nhận email …" + nút **Gửi lại email** (đếm ngược 60 giây); tự tải lại `/me` khi quay lại tab. Trang công khai `/email-verified` hiện kết quả. Ẩn khi đang impersonate.
- Extension không cần làm gì.

---

## 3. Từ vựng

### 3.1. Object `Word` (một dòng `user_words`)

```json
{
  "id": 42,
  "text": "ephemeral",
  "normalized_text": "ephemeral",
  "kind": "word",                     // "word" | "phrase"
  "source_lang": "en",
  "target_lang": "vi",
  "meaning": "ngắn ngủi, phù du",     // nghĩa chính người dùng thấy; null nếu chưa chọn
  "note": null,                       // ghi chú riêng của người dùng, tối đa 1000 ký tự (mục 3.7)
  "phonetic": "/ɪˈfem(ə)rəl/",        // từ dictionary_entries; null nếu không có
  "audio_url": "https://...mp3",      // null nếu không có
  "part_of_speech": "adjective",      // null nếu không có
  "status": "learning",               // "learning" | "known" (đã biết → bỏ khỏi lịch ôn)
  "fsrs_state": 0,                    // 0 mới · 1 đang học · 2 ôn tập · 3 học lại
  "due_at": null,                     // null khi chưa ôn lần nào
  "is_mastered": false,               // fsrs_state = 2 và stability >= 21
  "lapses": 0,
  "contexts_count": 1,
  "deck_ids": [],                     // deck chứa từ này (giai đoạn 5)
  "created_at": "2026-11-08T14:03:00Z",
  "updated_at": "2026-11-08T14:03:00Z",
  "saved_date": "2026-11-08",         // ngày lưu (created_at) theo múi giờ người dùng, YYYY-MM-DD (mục 3.11)
  "deleted_at": null                  // khác null khi nằm trong thùng rác
}
```

### 3.2. Object `Context` (một dòng `word_contexts`)

```json
{
  "id": 7,
  "sentence": "Fame in the age of social media is ephemeral.",
  "word_offset": 35,                  // vị trí ký tự (UTF-16, như JS) bắt đầu của từ trong câu; null nếu không xác định
  "word_length": 9,                   // độ dài đoạn từ trong câu (có thể khác text, ví dụ "ran" vs "run"); null nếu không xác định
  "page_title": "The Attention Economy",
  "page_url": "https://example.com/article",
  "meaning": "ngắn ngủi",             // nghĩa trong câu này; null nếu chưa chọn
  "meaning_source": "dictionary",     // "translation" | "dictionary" | "user" | "ai" | null
  "created_at": "2026-11-08T14:03:00Z"
}
```

- `meaning_source`: `translation` là bản dịch MyMemory do extension gửi kèm, `dictionary` là người dùng chọn một nghĩa trong từ điển, `user` là người dùng tự gõ, `ai` là để dành khi gắn AI.
- `sentence` tối đa **500 ký tự**. Extension tự cắt bớt quanh từ nếu câu dài hơn.

### 3.3. Object `MeaningCandidate` (gợi ý nghĩa để chọn, phương án A)

```json
{
  "key": "translation",               // chuỗi ổn định để FE làm key
  "source": "translation",            // "translation" | "dictionary"
  "part_of_speech": null,             // "noun", "adjective"... với nghĩa từ điển
  "text": "phù du",                   // nội dung nghĩa sẽ lưu nếu người dùng chọn
  "example": null                     // câu ví dụ trong từ điển, nếu có
}
```

Thứ tự: bản dịch (nếu extension gửi) đứng đầu, sau đó các nghĩa trong từ điển (tiếng Anh) theo thứ tự từ điển trả về, tối đa 8 mục.

> **Từ 09/11/2026 (chủ sản phẩm chốt): extension không còn bước chọn nghĩa sau khi Lưu.** Bấm Lưu là lưu luôn với nghĩa = bản dịch đang hiện (bước 5 mục 3.4), khung dịch chỉ báo "Đã lưu" + "Nghĩa: …". Lý do: nghĩa Free Dictionary là định nghĩa Anh–Anh, không hợp với người học. API vẫn trả `meaning_candidates`; web `/words/:id` vẫn dùng để "Đổi nghĩa".

### 3.4. `POST /api/words` 🔒: lưu từ (nút Lưu của extension)

```json
// request
{
  "text": "ephemeral",
  "source_lang": "en",
  "target_lang": "vi",
  "sentence": "Fame in the age of social media is ephemeral.",
  "word_offset": 35,                  // tùy chọn
  "word_length": 9,                   // tùy chọn
  "page_title": "The Attention Economy",   // tùy chọn
  "page_url": "https://example.com/article", // tùy chọn
  "translation": "phù du"            // tùy chọn: kết quả dịch extension đang hiện
}
```

Xử lý ở server (theo `database-redesign.html`, mục "Luồng lưu từ"):

1. Chuẩn hóa `text` → `normalized_text` (cắt khoảng trắng, chữ thường, gộp khoảng trắng giữa). `kind = "phrase"` nếu có khoảng trắng, ngược lại `"word"`.
2. Tra `dictionary_entries`. Chưa có thì gọi Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/<từ>`, chỉ khi `source_lang = "en"`), lưu lại kể cả khi không tìm thấy (để không gọi lại). Gọi lỗi hoặc quá 3 giây thì bỏ qua, vẫn lưu từ.
3. Tìm `user_words` theo (user, cặp ngôn ngữ, `normalized_text`), **kể cả dòng trong thùng rác**. Có trong thùng rác thì khôi phục. Chưa có thì tạo mới.
4. Thêm `word_contexts`. Trùng `sentence_hash` thì không thêm, trả về context đã có.
5. Nếu có `translation`: câu **mới tạo** nhận `context.meaning = translation`, `meaning_source = "translation"` (mỗi câu giữ nghĩa riêng của nó). `word.meaning` chỉ được đặt bằng `translation` khi đang `null`.
6. Tăng `daily_activity.words_saved` hôm nay nếu từ được **tạo mới**.

- Kiểm tra: `text` bắt buộc, 1–100 ký tự. `sentence` bắt buộc, tối đa 500. `source_lang`, `target_lang` bắt buộc, mã 2–10 ký tự. `page_url` nếu có phải là URL `http(s)`, tối đa 2048.
- `201` nếu tạo từ mới, `200` nếu từ đã có:

```json
{
  "word": { /* Word */ },
  "context": { /* Context */ },
  "word_created": true,
  "context_created": true,
  "meaning_candidates": [ /* MeaningCandidate */ ],
  "new_achievements": [ /* Achievement, mục 8.1; [] cho tới giai đoạn 6 */ ]
}
```

- Nếu `settings.save_page_url = false`: extension không gửi `page_url`, `page_title`; server cũng **bỏ cả hai** nếu nhận được.

### 3.5. `GET /api/words` 🔒: danh sách từ

| Tham số | Giá trị | Mặc định |
|---|---|---|
| `q` | Tìm theo `text` và `meaning` (chứa chuỗi, không phân biệt hoa thường; `%` và `_` là ký tự thường) | |
| `status` | `learning` \| `known` | cả hai |
| `kind` | `word` \| `phrase` | cả hai |
| `sort` | `-created_at` \| `created_at` \| `text` \| `due_at` | `-created_at` |
| `deck_id` | Chỉ từ trong deck này (giai đoạn 5) | |
| `hard` | `1`: chỉ từ khó (`learning`, `lapses >= hard_lapses`) (giai đoạn 5) | |
| `lang` | Chỉ từ có `source_lang` này, ví dụ `en`, `zh-cn` (không phân biệt hoa thường; sai định dạng → `422`) (mục 3.11) | mọi ngôn ngữ |
| `saved_from`, `saved_to` | Khoảng ngày lưu `YYYY-MM-DD` (theo múi giờ người dùng, tính cả hai đầu) (mục 3.11) | |
| `page`, `per_page` | | 1, 20 |

Không trả từ trong thùng rác. `200`: danh sách phân trang của `Word`.

### 3.6. `GET /api/words/{id}` 🔒

`200`:

```json
{ "word": { /* Word */ }, "contexts": [ /* Context, mới nhất trước */ ] }
```

Từ của người khác hoặc không tồn tại → `404`. Từ trong thùng rác vẫn xem được, nhưng `PATCH /words/{id}` và các endpoint ngữ cảnh trả `404` cho tới khi khôi phục.

### 3.7. `PATCH /api/words/{id}` 🔒: sửa từ

```json
// mọi trường đều tùy chọn, chỉ gửi trường đã đổi
{
  "text": "too tough",                // 1–100 ký tự
  "meaning": "quá cứng rắn",          // tối đa 500, null để xóa
  "kind": "phrase",                   // "word" | "phrase"
  "note": "gặp trong bài báo BBC",    // tối đa 1000, null để xóa
  "status": "known"                   // "learning" | "known"
}
```

- `text`: chuẩn hóa như bước 1 mục 3.4. **Giữ nguyên lịch ôn FSRS và lịch sử ôn.** Nếu không gửi `kind` thì `kind` tự tính lại theo khoảng trắng. Trùng với một từ khác của cùng người dùng, cùng cặp ngôn ngữ → `422 errors.text` "Bạn đã lưu từ này rồi." (từ đó nằm trong thùng rác thì câu báo: "Từ này đang nằm trong thùng rác. Hãy khôi phục từ đó."). Đổi chữ thì: tra lại từ điển (như bước 2 mục 3.4, ngoài transaction) và cập nhật `phonetic`, `audio_url`, `part_of_speech` (tra lỗi hoặc không thấy → các trường này về `null`, không giữ của chữ cũ); **tính lại `word_offset`/`word_length` của mọi câu ngữ cảnh** bằng cách tìm `text` mới trong câu (không phân biệt hoa thường, đơn vị UTF-16), không tìm thấy thì để `null`. Chỉ đổi hoa thường (`Ephemeral` → `ephemeral`) thì chỉ đổi `text`.
- `status = "known"`: bỏ khỏi lịch ôn. Đổi về `"learning"` thì ôn lại, giữ nguyên lịch FSRS cũ.
- `200 { "word": { /* Word */ } }`. Từ trong thùng rác → `404`.
- **Web:** nút **Sửa** ở mỗi dòng trong `/words` và ở đầu trang `/words/:id`, mở cùng một hộp thoại gồm: Từ/cụm từ, Nghĩa, Loại, Ghi chú. Chỉ gửi trường đã đổi; lỗi 422 hiện cạnh ô. Trang `/words/:id` hiện ghi chú.

### 3.8. Thùng rác

| Endpoint | Tác dụng | Response |
|---|---|---|
| `DELETE /api/words/{id}` 🔒 | Xóa mềm (vào thùng rác). Gọi lại khi đã trong thùng rác vẫn `204` | `204` |
| `GET /api/words/trash` 🔒 | Danh sách từ trong thùng rác, mới xóa trước. Tham số `q`, `page`, `per_page` | Phân trang `Word` |
| `POST /api/words/{id}/restore` 🔒 | Khôi phục. Từ không trong thùng rác vẫn `200` | `200 { "word": … }` |
| `DELETE /api/words/{id}/force` 🔒 | Xóa hẳn. Chỉ được khi từ đang trong thùng rác, ngược lại `409` | `204` |

Từ trong thùng rác quá 30 ngày bị job hằng ngày xóa hẳn (`config/learning.php` → `trash_days`).

### 3.9. Ngữ cảnh

| Endpoint | Tác dụng | Response |
|---|---|---|
| `PATCH /api/words/{id}/contexts/{contextId}` 🔒 | Đổi nghĩa của câu: `{ "meaning": "…", "meaning_source": "dictionary" \| "user" \| "translation" }`. Nếu `word.meaning` đang `null` thì đặt luôn `word.meaning` | `200 { "word": …, "context": … }` |
| `DELETE /api/words/{id}/contexts/{contextId}` 🔒 | Xóa một câu. Không cho xóa câu cuối cùng → `422`, lỗi ở `errors.context` | `204` |

### 3.10. `GET /api/words/{id}/meaning-candidates` 🔒

Lấy lại danh sách nghĩa để chọn (khi người dùng mở chi tiết từ trên web). `200 { "meaning_candidates": [ /* MeaningCandidate */ ] }`. Không có bản dịch MyMemory ở đây, chỉ có nghĩa từ điển và `word.meaning` hiện tại (nếu có: đứng đầu, `key: "current"`, `source: "translation"`).

---

### 3.11. Gom nhóm theo ngôn ngữ và thời gian

Chủ sản phẩm chốt 09/11/2026. Mọi ngày tính theo **múi giờ người dùng** (`users.timezone`), không theo UTC.

**`GET /api/words/languages` 🔒** — ngôn ngữ nguồn đang có (không tính thùng rác), cho hàng tab:

```json
{ "data": [ { "lang": "en", "count": 4 }, { "lang": "zh-cn", "count": 2 } ] }   // count giảm dần, rồi lang tăng dần
```

**`GET /api/words/groups?by=day|month|year` 🔒** — các nhóm thời gian, nhận cùng bộ lọc với `GET /api/words` (`q`, `status`, `kind`, `deck_id`, `hard`, `lang`) và `order=desc|asc` (mặc định `desc`):

```json
{
  "by": "day",
  "data": [
    { "key": "2026-11-09", "from": "2026-11-09", "to": "2026-11-09", "count": 3 },
    { "key": "2026-11-08", "from": "2026-11-08", "to": "2026-11-08", "count": 2 }
  ]
}
// by=month: key "2026-11", from "2026-11-01", to "2026-11-30"
// by=year:  key "2026",    from "2026-01-01", to "2026-12-31"
```

- Chỉ trả nhóm có ít nhất 1 từ. Tối đa 1000 nhóm. `by` sai → `422`.
- Web dùng `from`/`to` làm `saved_from`/`saved_to` khi cần tải riêng một nhóm.

**`GET /api/words`**: thêm tham số `lang`, `saved_from`, `saved_to`; `Word` thêm `saved_date`. Khi gom theo thời gian, web gọi với `sort=-created_at` (hoặc `created_at`) và tải thêm theo trang; mỗi từ thuộc nhóm theo `saved_date`.

**Web `/words`:**

- **Tab ngôn ngữ** đầu danh sách: "Tất cả N" + mỗi ngôn ngữ kèm số từ, tên tiếng Việt từ `Intl.DisplayNames('vi', { type: 'language' })` (`zh-cn` → "Tiếng Trung (Trung Quốc)" thì rút gọn còn "Tiếng Trung" nếu chỉ có một biến thể tiếng Trung). Chỉ có 1 ngôn ngữ → ẩn hàng tab.
- **"Nhóm theo"**: Ngày (mặc định) · Tháng · Năm · Không nhóm. Ngày: "Hôm nay", "Hôm qua", còn lại "Thứ Sáu · 06/11/2026"; Tháng: "Tháng 11/2026"; Năm: "Năm 2026".
- Tiêu đề nhóm dính (sticky) khi cuộn, hiện số từ (lấy từ `/words/groups`), bấm để thu gọn/mở, có ô "chọn cả nhóm" (chọn các từ đã tải của nhóm; nhóm chưa tải hết thì tải hết rồi chọn).
- Khi gom nhóm: ô Sắp xếp chỉ còn "Mới lưu trước" / "Cũ lưu trước". "Không nhóm" giữ đủ cách sắp xếp và phân trang cũ.
- Bỏ phân trang khi gom nhóm: tải thêm khi cuộn gần cuối (IntersectionObserver) + nút "Tải thêm" dự phòng.
- Lựa chọn nằm trên URL (`?lang=zh-cn&group=month`) và nhớ lần gần nhất trong `localStorage` (`tv.words.view`).

## 4. Từ điển

### 4.1. `GET /api/dictionary/lookup?text=ephemeral&lang=en` 🔒

Tra từ (dùng cache `dictionary_entries`, cùng logic bước 2 ở mục 3.4). `200`:

```json
{
  "entry": {
    "text": "ephemeral",
    "phonetic": "/ɪˈfem(ə)rəl/",
    "audio_url": "https://...mp3",
    "meanings": [
      { "part_of_speech": "adjective", "definition": "Lasting for a very short time.", "example": "fashions are ephemeral" }
    ]
  }
}
```

Không tìm thấy hoặc ngôn ngữ không hỗ trợ → `200 { "entry": null }`.

---

## 5. Ôn tập (giai đoạn 3, bổ sung ở giai đoạn 5)

### 5.1. Dạng bài và cách chấm

| `exercise_type` | Giai đoạn | Mô tả | Ai chấm |
|---|---|---|---|
| `flashcard` | 3 | Mặt trước: từ (+ phiên âm). Lật: nghĩa + câu ngữ cảnh. Người dùng bấm 1 trong 4 nút | Người dùng tự chọn `rating` |
| `mcq` | 3 | Hiện từ, chọn đúng nghĩa trong 4 đáp án | Client so với `answer_key` |
| `cloze` | 3 | Câu gốc che từ, gõ từ vào chỗ trống | Client so với `answer_text` (không phân biệt hoa thường, bỏ khoảng trắng hai đầu) |
| `listening` | 5 | Nghe phát âm, chọn đúng nghĩa trong 4 đáp án | Client so với `answer_key` |
| `dictation` | 5 | Nghe phát âm, gõ lại từ | Client so với `answer_text` |

- **4 mức `rating`:** `1` Quên · `2` Khó · `3` Được · `4` Dễ.
- **Bài có đúng/sai** (mọi dạng trừ flashcard): sai → client gửi `rating = 1`. Đúng → hiện 3 nút **Khó / Được / Dễ** để người dùng tự đánh giá độ khó, mặc định chọn sẵn "Được" (Enter = Được).
- Phát âm: dùng `word.audio_url`. Không có thì FE dùng `speechSynthesis` của trình duyệt (`lang = source_lang`).
- **Server chọn dạng bài cho từng thẻ**, trong các dạng người dùng bật (`settings.exercise_types`):
  - Từ mới (`fsrs_state = 0`): `flashcard`.
  - `stability < 7`: `mcq` hoặc `listening`.
  - `stability >= 7`: `cloze` (nếu từ có ngữ cảnh) hoặc `dictation`.
  - Dạng được chọn bị tắt thì lùi về dạng dễ hơn đang bật. `flashcard` luôn bật, không tắt được.
- `cloze`: gợi ý chữ cái đầu khi `stability < 7`. Câu ưu tiên câu ít được dùng gần đây.

### 5.2. Object `Card`

```json
{
  "card_id": "42-cloze",              // chuỗi duy nhất trong buổi ôn
  "word": { /* Word */ },
  "exercise_type": "cloze",
  "context": { /* Context */ },       // flashcard: câu để hiện khi lật (có thể null); cloze: câu dùng làm bài; mcq/listening/dictation: null
  "cloze": {                          // chỉ có khi exercise_type = "cloze", còn lại null
    "before": "Fame in the age of social media is ",
    "after": ".",
    "hint": "e"                       // null nếu không gợi ý
  },
  "options": [                        // mcq, listening: 4 phương án (nghĩa tiếng Việt), đã xáo trộn; còn lại null
    { "key": "a", "text": "phù du" },
    { "key": "b", "text": "bền vững" },
    { "key": "c", "text": "rực rỡ" },
    { "key": "d", "text": "xa xôi" }
  ],
  "answer_key": "a",                  // mcq, listening; còn lại null
  "answer_text": "ephemeral",         // cloze: đúng đoạn từ trong câu (theo word_offset/word_length); dictation: word.text; còn lại null
  "intervals": {                      // số giây tới lần ôn tiếp nếu chọn từng mức; FE tự định dạng "1 phút", "2 ngày"…
    "1": 60, "2": 172800, "3": 345600, "4": 777600
  }
}
```

- Đáp án nhiễu của `mcq`/`listening`: lấy `meaning` của từ khác cùng người dùng. Không đủ 3 từ có nghĩa thì đổi dạng bài thành `flashcard`.
- Từ chưa có `meaning` luôn ra dạng `flashcard`.

### 5.3. `POST /api/review/sessions` 🔒: bắt đầu buổi ôn

```json
// request
{ "mode": "daily", "deck_id": null }   // mode: "daily" | "hard" | "deck"
```

| `mode` | Thẻ lấy ra |
|---|---|
| `daily` | Từ đến hạn hôm nay (`status = learning`, `due_at <=` cuối ngày theo múi giờ user), sắp theo `due_at`, tối đa `daily_review_limit`. Sau đó là từ mới (`fsrs_state = 0`, cũ nhất trước), tối đa `daily_new_words − new_words_learned hôm nay`. **Chống dồn ứ:** số từ đến hạn > `daily_review_limit` thì không đưa từ mới vào |
| `hard` | Từ khó: `status = learning`, `lapses >= hard_lapses`, sắp theo `lapses` giảm dần, tối đa 20, không cần đến hạn |
| `deck` | Như `daily` nhưng chỉ trong deck `deck_id` (bắt buộc, deck của user, ngược lại `404`) |

Xen kẽ từ mới vào giữa từ ôn (interleaving), không dồn cuối. Không có thẻ nào thì vẫn tạo buổi và trả `cards: []`.

`201`:

```json
{
  "session": { "id": 9, "mode": "daily", "deck_id": null, "started_at": "2026-11-08T14:03:00Z" },
  "cards": [ /* Card */ ],
  "overload": false                   // true khi đang chống dồn ứ (FE hiện "Hôm nay nhiều từ cần ôn, tạm chưa thêm từ mới")
}
```

### 5.4. `POST /api/review/answer` 🔒: trả lời một thẻ

```json
// request
{
  "client_uuid": "6f1c…",             // UUID v4 do FE sinh cho mỗi lần trả lời
  "session_id": 9,
  "user_word_id": 42,
  "exercise_type": "cloze",
  "rating": 3,                        // 1–4
  "is_correct": true,                 // null với flashcard
  "answer": "ephemeral",              // người dùng gõ/chọn gì (tối đa 255); null với flashcard
  "word_context_id": 7                // câu đã dùng, null nếu không có
}
```

Lỗi: `client_uuid` đã được user khác dùng → `409`; `word_context_id` không thuộc từ → `422 errors.word_context_id`; từ trong thùng rác hoặc của người khác → `404`.

Server: khóa dòng `user_words`, tính FSRS (FSRS-6, port từ ts-fsrs 5.2.3, bước học 1m/10m, học lại 10m, không fuzz) (dùng `desired_retention` của user), thêm `review_logs`, cập nhật `user_words`, `daily_activity`, `review_sessions`, streak, XP và huy hiệu, **trong một transaction**. Gửi lại cùng `client_uuid` → không tính lần hai, trả lại kết quả của lần đầu (`200`).

`200`:

```json
{
  "word": { /* Word sau khi cập nhật */ },
  "next_due_at": "2026-11-12T14:03:00Z",
  "xp_earned": 10,
  "became_mastered": false,           // lần đầu đạt "đã thuộc"
  "today": { /* DailyProgress */ },
  "streak": { /* Streak */ },
  "new_achievements": [ /* Achievement */ ]
}
```

### 5.5. `POST /api/review/sessions/{id}/finish` 🔒

Đóng buổi ôn (đặt `ended_at`, `duration_seconds`). Gọi lại lần hai vẫn `200` với cùng kết quả.

```json
{
  "summary": {
    "cards_reviewed": 18, "correct_count": 15, "new_cards": 5,
    "xp_earned": 160, "duration_seconds": 412,
    "newly_mastered": 2
  },
  "today": { /* DailyProgress */ },
  "streak": { /* Streak */ },
  "xp": { /* Xp */ },
  "new_achievements": [ /* Achievement, mục 8.1 */ ]
}
```

- `correct_count` = số lượt có `rating >= 2`. `duration_seconds` tối đa 2 giờ (`max_session_seconds`), cộng vào `daily_activity.study_seconds`.

### 5.6. Object `DailyProgress`, `Streak`, `Xp`

```json
// DailyProgress (hôm nay theo múi giờ user)
{
  "date": "2026-11-08",
  "reviews_count": 18, "new_words_learned": 5, "words_saved": 3, "xp_earned": 160,
  "goal_new_words": 7,                // settings.daily_new_words
  "due_remaining": 4,                 // còn bao nhiêu từ đến hạn hôm nay (không tính từ mới fsrs_state = 0; có tính từ đang ở bước học vài phút)
  "goal_met": false                   // hôm nay có ≥ 1 lượt ôn, VÀ (due_remaining = 0 hoặc reviews_count >= daily_review_limit), VÀ học đủ goal_new_words (hoặc hết từ mới)
}

// Streak
{
  "current": 12, "longest": 30,
  "freezes_available": 1,             // tối đa max_freezes
  "last_active_date": "2026-11-08",
  "today_done": true                  // hôm nay đã có ít nhất 1 lượt ôn
}

// Xp
{ "total": 2350, "level": 7, "level_progress": 0.35, "xp_to_next_level": 130 }
```

**Luật streak** (`config/learning.php`): một ngày tính là "đã học" khi có ≥ 1 lượt ôn. Bỏ lỡ ngày: mỗi ngày bỏ lỡ tự dùng 1 thẻ đóng băng nếu còn (đánh dấu `daily_activity.freeze_used`), hết thẻ thì `current` về 0. Cứ đủ `freeze_every_days` (7) ngày liên tiếp (khi `current` chia hết cho 7) được thêm 1 thẻ, giữ tối đa `max_freezes` (2). Ngày dùng thẻ đóng băng giữ streak nhưng không cộng thêm vào `current`. Tính lại lúc trả lời thẻ đầu tiên trong ngày và lúc đọc streak.

**Luật XP** (`config/learning.php`, chỉ thưởng cho việc nhớ đúng): rating 3 hoặc 4 → 10 XP; rating 2 → 5 XP; rating 1 → 0. Từ lần đầu thành "đã thuộc" → thêm 50 XP. Huy hiệu → cộng `xp_reward`. Cấp độ: cấp `n` cần tổng `50·n·(n−1)` XP (cấp 1 = 0, cấp 2 = 100, cấp 3 = 300…).

---

## 6. Cài đặt, onboarding, thống kê, tài khoản (giai đoạn 4)

### 6.1. Object `Settings`

API trả giá trị đã phẳng (không trả `source`). Server vẫn lưu `source` trong `user_settings.settings` như database-redesign.

```json
{
  "timezone": "Asia/Ho_Chi_Minh",          // lưu ở users.timezone
  "daily_new_words": 7,                    // 1–50
  "reminder_time": "21:30",                // "HH:MM" theo múi giờ user, null = không nhắc
  "reminder_channels": ["browser", "email"],   // tập con của browser, email
  "exercise_types": ["flashcard", "mcq", "cloze", "listening", "dictation"], // luôn chứa flashcard
  "save_page_url": true,                   // false: extension không gửi page_url/page_title
  "daily_review_limit": 150,               // 20–500 (chống dồn ứ)
  "desired_retention": 0.9,                // 0.80–0.97
  "card_display": { "phonetic": true, "english_definition": false, "context_sentence": true },
  "weekly_report": true,
  "appearance": "system"                   // "system" | "light" | "dark" (mục 6.4)
}
```

Mặc định khi đăng ký: như trên, nhưng `exercise_types = ["flashcard","mcq","cloze"]`, `reminder_time = "21:00"`, `reminder_channels = ["browser"]`.

### 6.2. Endpoint

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/settings` 🔒 | | `200 { "settings": Settings }` |
| `PATCH /api/settings` 🔒 | Một phần của `Settings`. Trường được gửi lên đánh dấu `source = "user"`. `card_display` gửi một phần thì gộp với giá trị cũ. `exercise_types` thiếu `flashcard` thì server tự thêm. `desired_retention` làm tròn 2 chữ số | `200 { "settings": Settings }`. Sai giá trị → `422` |
| `POST /api/onboarding` 🔒 | `{ "goal": "exam"\|"work"\|"travel"\|"hobby", "level": "beginner"\|"intermediate"\|"advanced", "daily_minutes": 5\|10\|20 }` | `200 { "user": User, "settings": Settings }`. Đặt `onboarding_completed = true`. Gọi lại thì ghi đè các cài đặt có `source = "onboarding"`, không đụng cài đặt `source = "user"` |
| `GET /api/stats/summary` 🔒 | | `200` (xem dưới) |
| `GET /api/today` 🔒 | | `200 { "date", "studied": bool, "due_count": int, "reminder_time", "reminder_channels" }` (extension dùng để quyết định có hiện thông báo). `due_count` không tính từ mới |
| `DELETE /api/account` 🔒 | `{ "password": "…" }`; tài khoản không có mật khẩu (`has_password = false`) gửi `{ "confirm_email": "…" }` | `204`. Sai mật khẩu → `422 errors.password`; email không khớp → `422 errors.confirm_email`. Xóa user (cascade), thu hồi mọi token |

**Onboarding → cài đặt:** `daily_minutes` 5 → `daily_new_words = 3`, 10 → 7, 20 → 15. `level = beginner` → `exercise_types = ["flashcard","mcq"]`, còn lại `["flashcard","mcq","cloze"]`. `goal = exam` → `desired_retention = 0.92`, còn lại `0.9`.

`GET /api/stats/summary`:

```json
{
  "saved_count": 240,                 // mọi từ không trong thùng rác
  "learning_count": 200, "known_count": 40,
  "mastered_count": 85,
  "hard_count": 6,                    // learning, lapses >= hard_lapses
  "due_today": 22, "new_available_today": 7,
  "today": { /* DailyProgress */ },
  "streak": { /* Streak */ },
  "xp": { /* Xp */ }
}
```

### 6.3. Nhắc học

- **Thông báo trình duyệt (extension):** `chrome.alarms` hằng ngày vào `reminder_time` (lấy từ `GET /api/settings`, làm mới khi mở popup và mỗi 6 giờ). Đến giờ: gọi `GET /api/today`, `studied = false` và `reminder_channels` có `browser` thì hiện `chrome.notifications`, bấm vào mở `http://localhost:5173/review`. Lời nhắc nhẹ nhàng, không đe dọa (ví dụ "Có 12 từ đang chờ bạn ôn hôm nay").
- **Email (backend):** scheduler mỗi 15 phút tìm user có `email` trong `reminder_channels`, `reminder_time` khác `null`, đã qua `reminder_time` theo múi giờ user, hôm nay chưa học, chưa có `notification_logs` hôm nay → gửi Mailable (driver `log`) + ghi `notification_logs`. Không có API.

### 6.4. Giao diện sáng/tối

- `settings.appearance`: `"system"` (mặc định, theo hệ điều hành) · `"light"` · `"dark"`. Lưu trên server để đồng bộ giữa các máy và với extension.
- Áp dụng: `system` → **không** đặt `data-tv-mode`; `light`/`dark` → đặt `data-tv-mode="light"|"dark"` cạnh `data-tv-theme` (xem `brand/themes/themes.css`). Mọi CSS tự viết thêm (web `global.css`, extension popup, khung dịch, highlight) phải theo cùng quy tắc: `@media (prefers-color-scheme: dark) { …:not([data-tv-mode="light"]) }` + `…[data-tv-mode="dark"]`. Logo/ảnh có bản tối cũng đổi theo chế độ thực tế, không chỉ theo `prefers-color-scheme`.
- **Web:** nút chọn ở header (Hệ thống / Sáng / Tối), dùng được cả khi chưa đăng nhập; mục "Giao diện" trong `/settings`. Lưu ngay vào `localStorage` `tv.appearance` và áp dụng **trước khi React render** (script nhỏ trong `index.html`) để không nháy màu; đã đăng nhập thì `PATCH /settings { appearance }`. Khi tải settings từ server, giá trị server ghi đè `localStorage`.
- **Extension:** popup có nút chọn giống web (đã kết nối thì `PATCH /settings` qua background, chưa kết nối thì chỉ lưu local). Giá trị lưu ở `chrome.storage.local` (`tvAppearance`), lấy từ `GET /settings` khi mở popup và mỗi lần làm mới settings. Khung dịch và thẻ highlight đang mở đổi ngay qua `chrome.storage.onChanged`. `web-bridge.js` báo `appearance` của web khi đổi để extension cập nhật ngay.

---

## 7. Deck (giai đoạn 5)

Object `Deck`: `{ "id", "name", "color", "words_count", "due_count", "created_at" }`. `color` dạng `#RRGGBB` hoặc `null`.

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/decks` 🔒 | | `200 { "data": [Deck] }` (không phân trang, sắp theo tên) |
| `POST /api/decks` 🔒 | `{ "name": "IELTS", "color": null }` (tên 1–100, cắt và gộp khoảng trắng, không trùng trong cùng user, không phân biệt hoa thường; `color` lưu chữ hoa) | `201 { "deck": Deck }` |
| `PATCH /api/decks/{id}` 🔒 | `{ "name"?, "color"? }` | `200 { "deck": Deck }` |
| `DELETE /api/decks/{id}` 🔒 | | `204`. Từ trong deck vẫn giữ |
| `POST /api/decks/{id}/words` 🔒 | `{ "word_ids": [42, 43] }` (tối đa 200; từ không phải của user hoặc trong thùng rác → `422`, lỗi ở `errors["word_ids.N"]`) | `200 { "deck": Deck }`. Đã có thì bỏ qua |
| `DELETE /api/decks/{id}/words` 🔒 | `{ "word_ids": [42] }`. Từ không có trong deck thì bỏ qua | `200 { "deck": Deck }` |

- `GET /api/words` thêm tham số `deck_id` (lọc theo deck) và `hard=1` (chỉ từ khó).
- Object `Word` thêm `"deck_ids": [3, 5]`.
- Extension **không** hỏi deck khi lưu. Không có deck tự động.

---

## 8. Động lực và thống kê (giai đoạn 6)

### 8.1. Huy hiệu

Object `Achievement`: `{ "code", "name", "description", "icon", "xp_reward", "earned_at": "…"|null }`. `icon` là tên file trong `brand/icons` không có đuôi (ví dụ `"streak"`, `"badge"`).

`GET /api/achievements` 🔒 → `200 { "data": [Achievement] }`. Huy hiệu ẩn (`is_hidden`) chưa đạt thì **không trả về** (huy hiệu bất ngờ).

Bộ huy hiệu khởi đầu (seeder, `criteria` jsonb):

| `code` | Tên | Điều kiện | XP | Ẩn |
|---|---|---|---|---|
| `first_save` | Từ đầu tiên | Lưu 1 từ | 10 | |
| `first_review` | Buổi ôn đầu tiên | Hoàn thành 1 buổi ôn | 10 | |
| `streak_7` | Một tuần bền bỉ | Streak 7 ngày | 50 | |
| `streak_30` | Một tháng bền bỉ | Streak 30 ngày | 200 | |
| `mastered_50` | 50 từ vững | 50 từ đã thuộc | 100 | |
| `mastered_250` | 250 từ vững | 250 từ đã thuộc | 300 | |
| `sites_10` | Người đọc rộng | Lưu từ từ 10 trang web (host) khác nhau | 50 | ✓ |
| `perfect_session` | Không sai câu nào | Một buổi ôn ≥ 10 thẻ không có rating 1 | 30 | ✓ |
| `comeback` | Trở lại | Ôn lại sau ≥ 7 ngày nghỉ | 20 | ✓ |

Kiểm tra huy hiệu sau khi lưu từ (`POST /api/words` trả thêm `new_achievements`), sau khi trả lời thẻ và khi kết thúc buổi ôn. Cụ thể: `first_save`, `sites_10` xét khi lưu từ (`sites_10` đếm host khác nhau trong `page_url`, bỏ `www.`); `first_review`, `perfect_session` xét khi kết thúc buổi (buổi có ≥ 1 thẻ); `comeback` xét khi trả lời; huy hiệu streak và mastered xét ở cả 3 điểm. Đạt huy hiệu thì cộng `xp_reward` vào XP.

### 8.2. Báo cáo tuần

`GET /api/reports/weekly?week_start=2026-11-02` 🔒 (thứ Hai, mặc định tuần trọn vẹn gần nhất):

```json
{
  "week_start": "2026-11-02", "week_end": "2026-11-08",
  "days_active": 5, "reviews_count": 140, "words_saved": 32,
  "newly_mastered": 18, "mastered_total": 85,
  "accuracy": 0.86,                   // tỉ lệ lượt ôn rating >= 2; null khi không có lượt ôn nào
  "xp_earned": 1200,
  "previous": { "days_active": 4, "reviews_count": 110, "words_saved": 20, "newly_mastered": 12, "accuracy": 0.81 }
}
```

`week_start` không phải thứ Hai → `422`. `mastered_total` = số từ đã thuộc tính tới cuối tuần đó.

Email báo cáo tuần: scheduler sáng thứ Hai 08:00 theo múi giờ user, chỉ khi `weekly_report = true`, và không gửi nếu tuần đó không ôn và không lưu từ nào. Mailable, driver `log`. Câu chữ ghi nhận năng lực ("Tuần này bạn thuộc thêm 18 từ"), không so sánh với người khác.

### 8.3. Heatmap và biểu đồ tiến bộ

| Endpoint | Response |
|---|---|
| `GET /api/stats/heatmap?from=2025-11-09&to=2026-11-08` 🔒 (mặc định 365 ngày gần nhất, tối đa 366) | `200 { "days": [ { "date": "2026-11-08", "reviews_count": 18, "words_saved": 3, "freeze_used": false } ] }`. Chỉ trả ngày có hoạt động |
| `GET /api/stats/progress?days=30` 🔒 (7–365) | `200 { "points": [ { "date": "2026-11-08", "saved_total": 240, "mastered_total": 85, "reviews_count": 18 } ] }`. Đủ mọi ngày trong khoảng |

### 8.4. Highlight từ đã lưu (extension)

`GET /api/words/highlight-list` 🔒 → `200 { "generated_at": "…", "words": [ { "id", "text", "normalized_text", "kind", "meaning" } ] }`. Chỉ từ `status = learning`, không trong thùng rác, có `source_lang = "en"`.

Extension: tải danh sách vào `chrome.storage.local`, làm mới sau mỗi lần lưu từ và mỗi 6 giờ. Trên trang web, gạch chân nhẹ (màu `accent`) các từ đã lưu (khớp nguyên từ, không phân biệt hoa thường; cụm từ khớp cả cụm). **Dừng chuột trên từ khoảng 0,4 giây** mới hiện thẻ nhỏ "Bạn còn nhớ nghĩa?" và nút **Hiện nghĩa** (tự kiểm tra, không hiện nghĩa ngay). Thẻ đứng yên tới khi bấm ×, Esc hoặc bấm ra ngoài. Không gạch chân trên chính web app Transaver (trang có meta `transaver-web-app`). Bật/tắt trong popup (mặc định bật). Không chạy trong ô nhập, `contenteditable`, `<code>`, và chính khung dịch của extension. Giới hạn hiệu năng: quét tối đa 5.000 nút văn bản mỗi trang.

---

## 9. Admin (giai đoạn 6)

Mọi endpoint `/api/admin/*` cần `role = admin`, ngược lại `403`.

| Endpoint | Response |
|---|---|
| `GET /api/admin/stats` | `200 { "users_total", "users_active_7d", "words_total", "reviews_today", "reviews_7d" }`. `users_active_7d`: có lượt ôn hoặc lưu từ trong 7 ngày; `reviews_today` theo ngày UTC |
| `GET /api/admin/users?q=&page=` | Phân trang `AdminUser`: `{ "id", "email", "role", "status": "active"\|"banned", "created_at", "words_count", "last_active_date" }` |
| `PATCH /api/admin/users/{id}` | `{ "status"?: "active"\|"banned", "role"?: "user"\|"admin" }` → `200 { "user": AdminUser }`. Không được tự khóa hoặc tự hạ quyền chính mình → `422` |

Khóa (`status = banned`) thì thu hồi mọi token của user đó.

---

### 9.1. Superadmin: đăng nhập với tư cách người khác (impersonate)

**Vai trò:** thêm `"superadmin"` vào `User.role` (`"user" | "admin" | "superadmin"`). Superadmin có mọi quyền của admin, cộng thêm quyền impersonate. Chỉ superadmin mới đổi được vai trò của người khác thành `superadmin` hoặc sửa tài khoản superadmin. Admin thường không khóa, hạ quyền hay impersonate superadmin (`403`).

Tạo superadmin: seeder thêm `superadmin@transaver.local` / `password123`, và lệnh `php artisan user:superadmin {email}` để nâng một tài khoản có sẵn.

**Object `User`** (mục 2.1) thêm trường:

```json
"impersonator": null    // khi đang impersonate: { "id": 3, "email": "superadmin@transaver.local" }
```

| Endpoint | Request | Response |
|---|---|---|
| `POST /api/admin/users/{id}/impersonate` 🔒 superadmin | | `201 { "token": "…", "user": User (có impersonator), "expires_at": "…" }` |
| `POST /api/impersonation/stop` 🔒 (token impersonate) | | `204`. Thu hồi token impersonate. Gọi bằng token thường → `422` |

**Luật:**

- Không impersonate chính mình, tài khoản superadmin khác, hoặc tài khoản bị khóa → `422`, lỗi ở `errors.user`. `stop` bằng token thường → `422`, lỗi ở `errors.token`. Không phải superadmin → `403`.
- Token impersonate là Sanctum token riêng (tên `impersonation`), lưu `impersonator_id` (xóa superadmin thì token impersonate bị xóa theo, để không biến thành token thường), **hết hạn sau 2 giờ** (`config/learning.php` → `impersonation_minutes`). Không lồng: đang impersonate thì không gọi impersonate được (`403`).
- Trong lúc impersonate **bị chặn** (`403 "Không thực hiện được khi đang đăng nhập với tư cách người khác."`): `DELETE /account`, `POST /auth/logout` (dùng `/impersonation/stop`), mọi `/admin/*`.
- **Nhật ký:** bảng `impersonation_logs` (`impersonator_id`, `user_id`, `ip`, `user_agent`, `started_at`, `ended_at`). `GET /api/admin/impersonations?page=` (superadmin) → phân trang `{ id, impersonator_email, user_email, started_at, ended_at }`.
- Mọi lượt ôn, lưu từ… trong lúc impersonate vẫn ghi vào dữ liệu của user đó (đây là "xem như user"). Web hiện cảnh báo rõ.

**Web app:**

- `/admin` (superadmin): nút **"Đăng nhập với tư cách"** ở từng user (ẩn với chính mình, superadmin khác, tài khoản bị khóa). Bấm → hỏi xác nhận → lưu token gốc của superadmin vào `tv.auth.originalToken`, dùng token impersonate, về `/`.
- Khi `user.impersonator` khác `null`: **thanh cảnh báo cố định đầu trang** "Bạn đang xem với tư cách **email**" + nút **"Quay lại tài khoản của tôi"** → gọi `/impersonation/stop`, khôi phục token gốc, về `/admin`. Token impersonate hết hạn (`401`) cũng tự khôi phục token gốc.
- Trang nhật ký impersonate trong `/admin` (superadmin).

**Extension:** **không** nhận phiên impersonate. `web-bridge.js` gặp token có `impersonator` khác `null` thì bỏ qua, giữ nguyên phiên extension hiện có.

---

## 10. Màn hình web app

| Đường dẫn | Màn hình | Giai đoạn |
|---|---|---|
| `/register`, `/login` | Đăng ký, đăng nhập | 1 |
| `/onboarding` | 3 câu hỏi, hiện sau đăng ký khi `onboarding_completed = false` | 4 |
| `/` | Trang chủ: hôm nay cần ôn bao nhiêu, nút "Ôn ngay", streak, XP, thanh tiến độ ngày (bắt đầu ở mức tặng sẵn, không bắt đầu từ 0) | 4 |
| `/review` | Buổi ôn (`?mode=hard`, `?mode=deck&deck_id=3`) và màn hình kết thúc | 3 |
| `/words`, `/words/:id`, `/words/trash` | Từ của tôi, chi tiết từ, thùng rác | 2 |
| `/decks`, `/decks/:id` | Deck | 5 |
| `/stats` | Thống kê, heatmap, biểu đồ tiến bộ, huy hiệu, báo cáo tuần | 4, 6 |
| `/settings` | Cài đặt: mục tiêu, nhắc học, dạng bài, mức ghi nhớ, thông tin trên thẻ, báo cáo tuần, quyền riêng tư, xóa tài khoản | 4, 5 |
| `/privacy` | Chính sách quyền riêng tư (công khai, không cần đăng nhập) | 4 |
| `/admin` | Trang admin (chỉ `role = admin`) | 6 |

---

## 11. Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi |
|---|---|---|
| v0.1 | 08/11/2026 | Bản đầu: quy ước chung, auth, từ vựng, từ điển |
| v0.2 | 08/11/2026 | Backend dùng Laravel 12 + PostgreSQL. Mục 1.4: JSON UTF-8 thô, câu tổng hợp lỗi tiếng Việt. Mục 2.2: `device_name` tùy chọn. Mục 2.3: tài khoản bị khóa → 403 |
| v0.3 | 08/11/2026 | Thêm toàn bộ giai đoạn 3–6: ôn tập (mục 5), cài đặt/onboarding/thống kê/tài khoản/nhắc học (6), deck (7), huy hiệu/XP/báo cáo tuần/heatmap/highlight (8), admin (9), danh sách màn hình (10). `Word` thêm `deck_ids`; `GET /words` thêm `deck_id`, `hard`; `POST /words` trả thêm `new_achievements` |
| v0.4 | 08/11/2026 | Chốt giả định BE-2: câu mới luôn nhận nghĩa từ `translation`; `save_page_url=false` thì server bỏ cả url lẫn title; từ trong thùng rác chỉ GET được; DELETE/restore gọi lại vẫn thành công; lỗi xóa câu cuối ở `errors.context`; candidate `current`; `q` không dùng ký tự đại diện |
| v0.5 | 08/11/2026 | Chốt giả định BE-3: `finish` trả thêm `new_achievements`; định nghĩa `correct_count`, `due_remaining`, `goal_met`; luật tặng thẻ đóng băng; lỗi 409/422/404 của `answer`; thông số FSRS |
| v0.6 | 08/11/2026 | Chốt giả định BE-4: gộp `card_display`, tự thêm `flashcard`, làm tròn `desired_retention`, `/today.due_count` không tính từ mới, email chỉ gửi khi có `reminder_time` |
| v0.7 | 08/11/2026 | Chốt giả định BE-5: quy tắc tên deck, `color` chữ hoa, lỗi `word_ids.N`, xóa từ không có trong deck thì bỏ qua |
| v0.8 | 08/11/2026 | Chốt giả định BE-6: điểm xét từng huy hiệu, cách đếm `sites_10`, `accuracy` null, `week_start` phải là thứ Hai, không gửi email báo cáo tuần trống, định nghĩa số liệu admin |
| v0.9 | 08/11/2026 | Thêm vai trò `superadmin` và impersonate (mục 9.1): `User.impersonator`, `POST /admin/users/{id}/impersonate`, `POST /impersonation/stop`, nhật ký, chặn hành động nhạy cảm, extension không nhận phiên impersonate |
| v0.10 | 08/11/2026 | Mục 9.1: vị trí lỗi `errors.user`, `errors.token`; token impersonate bị xóa khi superadmin bị xóa |
| v0.11 | 08/11/2026 | Thêm `settings.appearance` (`system` \| `light` \| `dark`) và mục 6.4: nút chọn sáng/tối trên web và extension, đồng bộ qua server |
| v0.12 | 09/11/2026 | Thêm mục 2.6: đăng nhập bằng Google (redirect + mã một lần, `POST /auth/google/exchange`), liên kết theo email, tạo tài khoản mới |
| v0.13 | 09/11/2026 | `User.has_password`; `DELETE /account` cho tài khoản Google dùng `confirm_email` |
| v0.14 | 09/11/2026 | Ghi nhận thay đổi extension do chủ sản phẩm chốt: bỏ bước chọn nghĩa sau khi Lưu (mục 3.3), thẻ highlight hiện sau 0,4 giây và đóng bằng ×/Esc, không chạy trên web app (mục 8.4) |
| v0.15 | 09/11/2026 | Thêm mục 2.7: xác minh email (`User.email_verified`, link có chữ ký 24 giờ, gửi lại 1 lần/phút, email qua queue), chưa xác minh vẫn dùng app |
| v0.16 | 09/11/2026 | Mục 3.7: sửa được `text` (giữ lịch ôn, tra lại từ điển, tính lại vị trí trong câu, báo trùng), `note`; `Word.note`. Web có nút Sửa ở danh sách và chi tiết từ |
| v0.17 | 09/11/2026 | Mục 3.11: gom nhóm "Từ của tôi" theo ngôn ngữ (tab) và thời gian (ngày/tháng/năm, múi giờ người dùng): `GET /words/languages`, `GET /words/groups`, `GET /words` thêm `lang`, `saved_from`, `saved_to`; `Word.saved_date` |
