# Transaver Word: Quyết định chức năng cuối cùng

> Danh sách chức năng đã chốt, chọn từ [feature-list.html](feature-list.html). Chi tiết từng chức năng xem trong [feature-list.md](feature-list.md).
>
> Ngày chốt: 08/11/2026 · Tổng cộng: **32 chức năng**
>
> **Đã làm xong mục 1 và 2 (08/11/2026)**, xem [acceptance.md](acceptance.md).
>
> Phạm vi: **chưa hỗ trợ điện thoại**. Không làm web responsive, push notification hay app mobile.

---

## 1. Phải có: MVP (16)

**Extension**
- [x] Dịch khi bôi đen (nhiều ngôn ngữ, đọc to, sao chép) · *đã có*
- [x] Nút "Lưu" kèm câu ngữ cảnh và link trang
- [x] Nghĩa theo ngữ cảnh, phiên âm, phát âm

**Tài khoản**
- [x] Đăng nhập Google

**Từ vựng**
- [x] Danh sách từ đã lưu: tìm, sửa, xóa
- [x] Đánh dấu "đã biết" để bỏ khỏi lịch ôn
- [x] Một từ có nhiều câu ngữ cảnh

**Ôn tập**
- [x] Lịch ôn tự động (FSRS)
- [x] Flashcard và trắc nghiệm
- [x] **Điền chỗ trống bằng câu gốc:** che từ trong câu người dùng đã gặp, người dùng phải tự nhớ ra từ đó. Điểm khác biệt chính của sản phẩm

**Cá nhân hóa và nhắc học**
- [x] Onboarding 3 câu hỏi
- [x] Mục tiêu mỗi ngày, giờ nhắc học
- [x] Nhắc học qua thông báo trình duyệt và email

**Động lực**
- [x] Streak và thẻ đóng băng
- [x] Thống kê cơ bản: đã lưu, đã thuộc, cần ôn hôm nay

**Nền tảng**
- [x] Chính sách quyền riêng tư, xóa tài khoản

---

## 2. Tốt nếu có: sau MVP (11)

**Extension**
- [x] Highlight từ đã lưu khi lướt web
- [x] Lưu cụm từ, thành ngữ

**Từ vựng**
- [x] Bộ từ (deck) và tag
  - Chỉ chọn deck **trên web app**, trong phần quản lý từ. Extension lưu từ như bình thường, không hỏi deck.
  - Không có deck tự động theo website. Từ mới lưu không thuộc deck nào cho tới khi người dùng tự xếp.

**Ôn tập**
- [x] Dạng bài nghe và gõ chính tả
- [x] Ôn riêng từ khó
- [x] Chống dồn ứ khi quá nhiều từ đến hạn
- [x] Tùy chỉnh mức ghi nhớ và thông tin trên thẻ

**Động lực và thống kê**
- [x] XP, cấp độ, huy hiệu
- [x] Báo cáo tuần
- [x] Heatmap và biểu đồ tiến bộ

**Vận hành**
- [x] Trang admin cơ bản

---

## 3. Để sau (5)

- [ ] Ảnh minh họa cho từ
- [ ] Chia sẻ bộ từ
- [ ] Tự đặt câu, AI chấm
- [ ] Học cùng bạn bè, bảng xếp hạng
- [ ] Đổi điểm lấy theme, Premium
  - Đã thiết kế, chưa dev: 3 theme miễn phí, 7 theme mở khóa bằng điểm streak hoặc mua, 5 theme theo dịp (Tết, Trung thu, Halloween, 20/11, Giáng sinh) tự áp dụng cho toàn hệ thống trong thời gian của dịp. Đặc tả: [theme-system.md](theme-system.md)

---

## 4. Không chọn (12)

Các chức năng này không nằm trong kế hoạch hiện tại.

| Mức đề xuất ban đầu | Chức năng |
|---|---|
| Phải có | Lưu offline, tự đồng bộ khi có mạng |
| Phải có | Dùng thử không cần tài khoản |
| Phải có | Đồng bộ giữa extension và web app |
| Phải có | Kiểm soát chi phí AI (cache, giới hạn lượt) |
| Phải có | Nút góp ý và ghi số liệu sử dụng |
| Tốt nếu có | Side panel ôn nhanh trong trình duyệt |
| Tốt nếu có | Phím tắt lưu nhanh |
| Tốt nếu có | Xuất dữ liệu (CSV, Anki) |
| Để sau | Hỗ trợ Firefox, Edge |
| Để sau | Nhập từ Anki, Quizlet |
| Để sau | Mini game ghép cặp có tính giờ |
| Để sau | Nhắc học qua Telegram |

---

## 5. Cần xem lại

Ba chức năng bị bỏ ở mục 4 có liên quan trực tiếp tới các chức năng đã chọn. Nên xem lại trước khi bắt đầu code:

1. **Đồng bộ giữa extension và web app.** Từ được lưu ở extension, nhưng danh sách từ, ôn tập, thống kê và cài đặt nằm ở web app. Không có đồng bộ thì web app không thấy từ đã lưu. Nếu đã có đăng nhập Google và backend lưu dữ liệu, phần đồng bộ cơ bản gần như có sẵn: extension gọi API lưu từ lên server. Bỏ được phần khó là *lưu offline và xử lý xung đột*.
2. **Kiểm soát chi phí AI.** Đã chọn "Nghĩa theo ngữ cảnh" (gọi AI mỗi lần lưu từ). Không có cache và giới hạn lượt thì chi phí tăng theo số người dùng, không kiểm soát được.
3. **Ghi số liệu sử dụng.** [Mục 9 của product-plan.md](product-plan.md#9-nguyên-tắc-chọn-tính-năng) dùng số liệu (tỉ lệ quay lại sau 7 ngày…) để quyết định làm gì tiếp. Không ghi số liệu thì khó chọn chức năng cho giai đoạn sau.

---

## 6. Ảnh hưởng tới thiết kế database

Đối chiếu với [database-design.md](database-design.md):

- **Vẫn giữ:** `users`, `user_settings`, `dictionary_entries`, `user_words`, `word_contexts`, `review_logs`, `review_sessions`, `daily_activity`, `streaks`, `notification_logs`.
- **Giữ cho giai đoạn sau:** `decks`, `deck_words`, `tags`, `user_word_tags`, `achievements`, `user_achievements`.
- **Có thể bỏ nếu giữ quyết định ở mục 4:** `ai_usage_daily` (không giới hạn lượt AI), `events` và `feedback` (không ghi số liệu, không có nút góp ý).
- **Đơn giản hóa:** không lưu offline nên không cần cơ chế đồng bộ xung đột ở [mục 5 của database-design.md](database-design.md#5-đồng-bộ-offline-và-xử-lý-xung-đột). Vẫn nên giữ cột `uuid` để gửi lại request không bị tạo trùng.
