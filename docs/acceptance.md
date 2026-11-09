# Transaver Word: Nghiệm thu

> Đối chiếu 27 chức năng (16 Phải có + 11 Tốt nếu có) trong [final-decision-features.md](final-decision-features.md) với code đã viết. Nhóm "Để sau" không làm.
>
> Ngày nghiệm thu: 08/11/2026 · Người kiểm tra: orchestrator (session transaver-word-62)

## Cách kiểm tra

| Ký hiệu | Nghĩa |
|---|---|
| **T** | Có test tự động ở backend (`php artisan test`: 198 test, tất cả đạt (09/11/2026)) |
| **A** | Orchestrator chạy luồng API thật end-to-end bằng tài khoản mới: 37/37 bước đạt (đăng ký → onboarding → lưu từ → deck → ôn → thống kê → highlight → thùng rác → xóa tài khoản) |
| **U** | Orchestrator mở trang trên Chrome headless với backend thật: render đúng, 0 lỗi console, 0 lỗi HTTP |
| **F** | Front-end tự chạy thử bằng Chrome headless (mock và backend thật) theo báo cáo, orchestrator chưa tự chạy lại |

## 1. Phải có (16)

| # | Chức năng | Nằm ở | Kiểm tra |
|---|---|---|---|
| 1 | Dịch khi bôi đen (đã có từ trước) | `extension/src/content.js`, `background.js` | F |
| 2 | Nút "Lưu" kèm câu ngữ cảnh và link trang | Extension `src/context.js`, `content.js` · API `POST /words` | T A F |
| 3 | Nghĩa theo ngữ cảnh, phiên âm, phát âm | Chọn nghĩa sau khi lưu (phương án A), Free Dictionary API · **AI để chủ sản phẩm gắn** | T A F |
| 4 | Đăng nhập (đổi thành email + mật khẩu, không xác nhận email) | `/register`, `/login` · `POST /auth/*` · extension dùng chung phiên với web (`src/web-bridge.js`) | T A U F |
| 5 | Danh sách từ: tìm, sửa, xóa | `/words`, `/words/:id`, `/words/trash` | T A U |
| 6 | Đánh dấu "đã biết" | `/words` · `PATCH /words/{id}` | T A |
| 7 | Một từ nhiều câu ngữ cảnh | `/words/:id` · `word_contexts` | T A |
| 8 | Lịch ôn tự động (FSRS) | `backend/app/Fsrs` (port ts-fsrs, so khớp 24 chuỗi) | T A |
| 9 | Flashcard và trắc nghiệm | `/review` | T A U F |
| 10 | Điền chỗ trống bằng câu gốc | `/review` dạng `cloze` | T F |
| 11 | Onboarding 3 câu hỏi | `/onboarding` · `POST /onboarding` | T A F |
| 12 | Mục tiêu mỗi ngày, giờ nhắc học | `/settings` · `PATCH /settings` | T U F |
| 13 | Nhắc học qua thông báo trình duyệt và email | Extension `chrome.alarms` · lệnh `reminders:send` (**email ghi log, chưa gửi thật**) | T F |
| 14 | Streak và thẻ đóng băng | Trang chủ, tổng kết buổi ôn · `user_progress` | T A U |
| 15 | Thống kê cơ bản | Trang chủ, `/stats` · `GET /stats/summary` | T A U |
| 16 | Chính sách quyền riêng tư, xóa tài khoản | `/privacy`, `/settings` · `DELETE /account` | T A U F |

## 2. Tốt nếu có (11)

| # | Chức năng | Nằm ở | Kiểm tra |
|---|---|---|---|
| 17 | Highlight từ đã lưu khi lướt web | Extension `src/highlight.js` (CSS Custom Highlight API) · `GET /words/highlight-list` | T A F |
| 18 | Lưu cụm từ, thành ngữ | `user_words.kind = phrase` | T A |
| 19 | Bộ từ (deck), chỉ chọn trên web | `/decks`, `/decks/:id`, `/words` · `/decks/*` | T A U F |
| 20 | Dạng bài nghe và gõ chính tả | `/review` dạng `listening`, `dictation` | T F |
| 21 | Ôn riêng từ khó | `/review?mode=hard` | T F |
| 22 | Chống dồn ứ | `daily_review_limit`, cờ `overload` | T |
| 23 | Tùy chỉnh mức ghi nhớ và thông tin trên thẻ | `/settings` · `desired_retention`, `card_display` | T U F |
| 24 | XP, cấp độ, huy hiệu | Trang chủ, `/stats` · 9 huy hiệu | T A U |
| 25 | Báo cáo tuần | `/stats` · `GET /reports/weekly`, lệnh `reports:weekly` (email ghi log) | T A U |
| 26 | Heatmap và biểu đồ tiến bộ | `/stats` | T A U |
| 27 | Trang admin cơ bản | `/admin` · `/admin/*` | T A F |

## 2b. Chức năng thêm sau nghiệm thu (chủ sản phẩm yêu cầu)

| Chức năng | Nằm ở | Kiểm tra |
|---|---|---|
| Superadmin "Đăng nhập với tư cách" + "Quay lại tài khoản của tôi", nhật ký | `/admin` · `POST /admin/users/{id}/impersonate`, `/impersonation/stop` (contract 9.1) | T A U F |
| Nút chọn giao diện Hệ thống / Sáng / Tối, đồng bộ web ↔ extension qua server | Header web, `/settings`, popup extension · `settings.appearance` (contract 6.4) | T U F |
| Extension dùng chung phiên đăng nhập với web (bỏ form trong popup) | `extension/src/web-bridge.js` | F |
| Sửa từ: chữ, nghĩa, loại, ghi chú (giữ lịch ôn, tính lại vị trí trong câu, báo trùng) | `/words`, `/words/:id` · `EditWordDialog` · `PATCH /words/{id}` (contract 3.7) | T A U F |
| Xác minh email khi đăng ký (email qua queue, thanh nhắc, gửi lại) | `EmailVerifyBanner`, `/email-verified` · contract 2.7 | T A |
| Gom nhóm "Từ của tôi" theo ngôn ngữ (tab) và thời gian (Ngày/Tháng/Năm, múi giờ người dùng), tiêu đề nhóm dính, chọn cả nhóm, tải thêm khi cuộn | `/words` · `GroupedWordList` · `GET /words/languages`, `/words/groups` (contract 3.11) | T A U F |
| Đăng nhập bằng Google (liên kết theo email, tạo tài khoản mới, xóa tài khoản bằng email) | `/login`, `/register`, `/auth/google/callback` · `GoogleAuthController` (contract 2.6) | T U (trừ màn hình Google) |

## 3. Việc còn lại

- [x] Admin chưa onboarding mở `/admin` bị chuyển sang `/onboarding`: đã sửa (FIX FE-7.1).
- [ ] Khi lên production: giới hạn `web-bridge.js` vào đúng domain web app (hiện chạy trên mọi trang `localhost` có thẻ meta `transaver-web-app`).
- [ ] Chủ sản phẩm tự gắn: AI nghĩa theo ngữ cảnh, gửi email thật (xem [README.md](../README.md)).
- [ ] Extension chưa dùng `themes.css` (màu teal viết trực tiếp). Làm khi dev hệ thống theme.
- [ ] Chưa commit. Chủ sản phẩm quyết định khi nào commit.
- [ ] Chủ sản phẩm tự thử extension trên Chrome thật (orchestrator chỉ kiểm tra cú pháp, Front-end đã thử bằng Chromium headless).
