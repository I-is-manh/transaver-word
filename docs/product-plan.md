# Transaver Word: Định hướng sản phẩm

> Extension dịch và lưu từ vựng, giúp người dùng học lại từ mới một cách khoa học, có thưởng và cá nhân hóa.
>
> Ngày soạn: 05/11/2026

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Lợi thế cốt lõi: lưu từ kèm ngữ cảnh](#2-lợi-thế-cốt-lõi-lưu-từ-kèm-ngữ-cảnh)
3. [Nền tảng tâm lý học](#3-nền-tảng-tâm-lý-học)
4. [Các dạng bài tập](#4-các-dạng-bài-tập)
5. [Cá nhân hóa](#5-cá-nhân-hóa)
6. [Phần thưởng và động lực](#6-phần-thưởng-và-động-lực)
7. [Kiến trúc kỹ thuật](#7-kiến-trúc-kỹ-thuật)
8. [Phạm vi: làm gì trước, làm gì sau](#8-phạm-vi-làm-gì-trước-làm-gì-sau)
9. [Nguyên tắc chọn tính năng](#9-nguyên-tắc-chọn-tính-năng)
10. [Tài liệu tham khảo](#10-tài-liệu-tham-khảo)

---

## 1. Tổng quan

**Ý tưởng chính:** khi người dùng dịch một từ trên trình duyệt, họ chỉ cần nhấn **"Lưu"** là từ đó được lưu lại, không phải ghi chép. App sẽ nhắc họ **học lại đúng thời điểm** để nhớ lâu.

**Thông điệp sản phẩm (một câu):**
> *Lưu từ một chạm, ôn lại bằng chính câu bạn đã đọc.*

**Ba thành phần bắt buộc** để lưu dữ liệu riêng cho từng người và đồng bộ được giữa nhiều thiết bị:

| Thành phần | Vai trò |
|---|---|
| **Extension** | Nơi người dùng gặp từ mới: dịch và lưu |
| **Backend** | Tài khoản, lưu trữ, đồng bộ, lập lịch ôn, gửi nhắc nhở |
| **Web app** | Nơi học lại, làm bài tập, xem thống kê, chỉnh cài đặt |

**Triết lý:** đặt **cá nhân hóa** lên hàng đầu, nhưng theo hướng *mặc định thông minh, ít tùy chọn mà đúng chỗ, app tự thích nghi* chứ không phải hàng chục nút cài đặt.

---

## 2. Lợi thế cốt lõi: lưu từ kèm ngữ cảnh

Anki hay Quizlet bắt người dùng tự nhập từ. Extension này bắt được từ **đúng lúc người dùng gặp nó**. Khi nhấn "Lưu", tự động lưu kèm:

- Câu chứa từ đó, tên trang, đường link
- **Nghĩa đúng theo ngữ cảnh** (dùng AI chọn nghĩa phù hợp, không lấy cả danh sách nghĩa trong từ điển)
- Phiên âm, file phát âm, từ loại
- Ảnh minh họa (tùy chọn)

**Cơ sở khoa học:**
- *Encoding specificity* (Tulving & Thomson, 1973): nhớ lại dễ hơn khi có ngữ cảnh lúc học.
- *Self-reference effect* (Rogers et al., 1977): thông tin gắn với trải nghiệm của chính mình được nhớ tốt hơn.

→ Câu bài tập lấy từ chính bài báo người dùng từng đọc sẽ hiệu quả hơn nhiều so với câu mẫu chung chung.

---

## 3. Nền tảng tâm lý học

| Nguyên lý | Nghiên cứu | Áp dụng vào app |
|---|---|---|
| Đường cong quên lãng | Ebbinghaus (1885) | Giải thích cho người dùng vì sao cần ôn đúng lúc |
| Hiệu ứng giãn cách (Spacing effect) | Cepeda et al. (2006) | Lịch ôn tự động, khoảng cách tăng dần |
| Học bằng gợi nhớ (Retrieval practice / Testing effect) | Roediger & Karpicke (2006) | Bắt người dùng **tự nhớ ra** đáp án thay vì chỉ đọc lại |
| Hiệu ứng tự tạo ra (Generation effect) | Slamecka & Graf (1978) | Bài tập gõ từ, tự đặt câu |
| Khó khăn có lợi (Desirable difficulties) | Bjork (1994) | Bài tập khó dần theo mức thuộc của từng từ |
| Học xen kẽ (Interleaving) | Rohrer & Taylor (2007) | Trộn từ nhiều chủ đề trong một buổi ôn |
| Mã hóa kép (Dual coding) | Paivio (1971) | Kết hợp từ, ảnh và âm thanh |
| Thuyết tự quyết (Self-Determination Theory) | Deci & Ryan (2000) | Cho người dùng **tự chủ**, thấy mình **tiến bộ**, có **kết nối**. Đây là nền tảng cho phần cá nhân hóa |
| Mô hình hành vi B = MAP | Fogg (2009) | Bài học cực ngắn (dễ làm) và nhắc nhở đúng lúc |
| Ý định thực thi (Implementation intentions) | Gollwitzer (1999) | Cho người dùng đặt cam kết kiểu "Tôi sẽ học lúc 21h sau khi ăn tối" |
| Hiệu ứng gần đích (Goal gradient) | Kivetz et al. (2006) | Thanh tiến độ, "còn 3 từ nữa là xong hôm nay" |
| Hiệu ứng tiến độ được tặng sẵn (Endowed progress) | Nunes & Drèze (2006) | Thanh tiến độ bắt đầu ở 10–20% thay vì 0% |
| Sợ mất mát (Loss aversion) | Kahneman & Tversky (1979) | Chuỗi ngày học liên tiếp (streak). Phải dùng cẩn thận, xem [mục 6](#6-phần-thưởng-và-động-lực) |
| ⚠️ Thưởng làm giảm động lực (Overjustification effect) | Deci (1971); Lepper et al. (1973) | Phần thưởng phải **ghi nhận năng lực**, không biến việc học thành "làm để lấy điểm" |

### Thuật toán ôn tập: FSRS

- Dùng **FSRS** (Free Spaced Repetition Scheduler, Ye, 2022) thay cho SM-2 cũ. Anki đã chuyển sang FSRS.
- FSRS tự điều chỉnh tham số theo lịch sử ôn của **từng người**, tức là cá nhân hóa ngay ở tầng thuật toán.
- Thư viện mã nguồn mở có sẵn: **`ts-fsrs`** (TypeScript). **Không tự viết lại thuật toán.**

---

## 4. Các dạng bài tập

Sắp xếp từ dễ đến khó. App tự nâng cấp dạng bài theo mức thuộc của từng từ.

| # | Dạng bài | Mô tả |
|---|---|---|
| 1 | **Nhận diện** | Flashcard lật thẻ, trắc nghiệm 4 đáp án (Anh → Việt) |
| 2 | **Nghe** | Nghe phát âm rồi chọn nghĩa |
| 3 | **Nhớ lại** | Trắc nghiệm ngược (Việt → Anh) |
| 4 | **Điền chỗ trống bằng câu gốc** | Dùng chính câu người dùng đã gặp. *Đây là điểm khác biệt của sản phẩm* |
| 5 | **Gõ chính tả** | Nghe rồi gõ lại từ |
| 6 | **Ghép cặp** | Ghép từ với nghĩa, có tính giờ (mini game) |
| 7 | **Tự đặt câu** | AI chấm và sửa (generation effect mạnh nhất) |
| 8 | **Bắt gặp lại trên web** | Khi lướt web, trang có từ đã lưu thì extension highlight từ đó, di chuột vào để tự kiểm tra. Ôn mà không cần mở app |

**Nguyên tắc:** mỗi từ có **mức thuộc từ 0 đến 5**. Từ mới thì cho trắc nghiệm, từ đã khá thuộc thì bắt gõ hoặc đặt câu.

---

## 5. Cá nhân hóa

### 5.1. Người dùng tự chỉnh được

- **Mục tiêu mỗi ngày:** số từ mới và số phút học (5, 10, 20 phút)
- **Nhắc học:** giờ nhắc, kênh nhắc (thông báo trình duyệt, email, Telegram)
- **Dạng bài:** bật/tắt từng dạng (có người ghét gõ phím, có người ghét nghe)
- **Mức độ thử thách:** muốn thuộc chắc hơn thì ôn dày hơn (tương đương chỉ số *desired retention* của FSRS: 85%, 90% hay 95%)
- **Thông tin hiện trên thẻ:** phiên âm, ảnh, câu ví dụ, nghĩa tiếng Anh
- **Bộ từ (deck):** tự tạo, gắn tag, hoặc tự động nhóm theo website / chủ đề
- **Giao diện:** sáng/tối, cỡ chữ, phím tắt
- **Mức độ game hóa:** từ bật hết (điểm, huy hiệu, bảng xếp hạng) đến tối giản không có gì. Người lớn đi làm thường thấy game hóa phiền

### 5.2. App tự thích nghi theo người dùng

- FSRS tự học tốc độ quên của từng người
- Phát hiện từ **"khó"** (sai nhiều lần) để ôn riêng và đổi dạng bài cho từ đó
- Gợi ý giờ học dựa trên giờ người dùng thường học thực tế
- **Chống dồn ứ:** ngày có quá nhiều từ đến hạn ôn thì tự giãn bớt, tránh làm người dùng nản

### 5.3. Onboarding

Khoảng 3 câu hỏi: **mục tiêu học, trình độ, thời gian rảnh mỗi ngày**. App tự tạo cấu hình ban đầu từ đó, người dùng sửa lại được bất cứ lúc nào.

---

## 6. Phần thưởng và động lực

### ✅ Nên có

- **Streak + thẻ đóng băng (streak freeze):** nghỉ một ngày không mất chuỗi. Streak mất vì lý do chính đáng khiến người dùng bỏ app luôn
- **XP và cấp độ** phản ánh **kỹ năng thật**, ví dụ "Đã thuộc vững 250 từ", không chỉ đếm số lần bấm
- **Huy hiệu bất ngờ:** phần thưởng không đoán trước được rất kích thích, ví dụ "Lưu từ từ 10 trang web khác nhau"
- **Báo cáo tuần:** "Tuần này bạn thuộc thêm 32 từ, trí nhớ dài hạn tăng 8%". Phản hồi về năng lực, phù hợp với SDT
- **Heatmap** các ngày học, giống kiểu GitHub
- **Phần thưởng hữu hình:** mở khóa theme, giọng đọc, sticker. Nếu có mô hình kinh doanh thì có thể đổi điểm lấy ngày dùng Premium
- **Yếu tố xã hội (không bắt buộc):** học cùng bạn bè, giải đấu tuần theo nhóm ngang trình độ, chia sẻ bộ từ

### ❌ Nên tránh

- Thông báo kiểu đe dọa, gây cảm giác tội lỗi
- Bảng xếp hạng toàn cầu bật mặc định (người mới thấy mình đứng cuối sẽ nản)
- Thưởng cho hành vi lướt nhanh cho xong. **Phải thưởng cho việc nhớ đúng**

---

## 7. Kiến trúc kỹ thuật

```
[Chrome Extension MV3]                       [Web App học bài]
 - content script: bôi đen → dịch → Lưu       - Ôn tập, bài tập, thống kê
 - side panel: ôn nhanh 5 thẻ                 - Cài đặt cá nhân hóa
 - IndexedDB (offline-first)                          │
          │                                           │
          └────────────── REST API + JWT ─────────────┘
                                │
                     [Backend: Laravel (PHP)]
                      - Auth (Google OAuth)
                      - Đồng bộ, lập lịch FSRS
                      - Dịch/AI, TTS, gửi nhắc nhở (queue + cron)
                                │
                     MySQL/PostgreSQL + Redis
```

**Công nghệ đề xuất:**
- **Backend:** Laravel (PHP)
- **Extension + Web app:** React hoặc Vue + TypeScript, để dùng chung code bài tập
- **Thuật toán ôn:** `ts-fsrs`

### Các bảng dữ liệu chính

| Bảng | Nội dung |
|---|---|
| `users` | Tài khoản người dùng |
| `user_settings` | Cấu hình cá nhân hóa, **lưu dạng JSON** để dễ mở rộng |
| `words` | Thông tin chung của từ (từ, phiên âm, âm thanh, …) |
| `user_words` | Từ của từng user: ngữ cảnh, URL, tag, nghĩa theo ngữ cảnh, trạng thái FSRS, mức thuộc |
| `review_logs` | **Lịch sử từng lần ôn**: thời điểm, dạng bài, kết quả, thời gian trả lời. FSRS cần bảng này để tối ưu tham số |
| `decks` | Bộ từ do người dùng tạo |
| `achievements` | Huy hiệu đã đạt |
| `streaks` | Chuỗi ngày học, thẻ đóng băng |

> ⚠️ **Thiết kế database cho tương lai ngay từ đầu**, dù chưa làm hết tính năng. Đặc biệt là `review_logs` chi tiết và `user_settings` dạng JSON. Đây là phần khó sửa nhất về sau, còn giao diện và tính năng thì thêm lúc nào cũng được.

---

## 8. Phạm vi: làm gì trước, làm gì sau

**Không nên đưa hết tính năng vào ngay từ đầu**, vì:

1. **Vibecoding càng nhiều tính năng càng dễ vỡ:** code do AI sinh ra phình nhanh, tính năng chồng chéo thì sửa chỗ này hỏng chỗ kia.
2. **Chưa có người dùng thật thì chưa biết họ cần gì:** phải có dữ liệu thật rồi mới quyết.
3. **Nhiều tính năng làm loãng sản phẩm:** người dùng nên nhớ app bằng một câu, không phải 30 tính năng.
4. **Nhiều tùy chỉnh quá cũng là gánh nặng:** cá nhân hóa không có nghĩa là có 50 nút cài đặt.

### ✅ Giai đoạn 1: Bắt buộc có (MVP)

Đây là phần cốt lõi, thiếu là app mất ý nghĩa.

- [ ] Bôi đen → dịch → **Lưu kèm câu ngữ cảnh + link**
- [ ] Đăng nhập, đồng bộ dữ liệu theo user
- [ ] Ôn tập bằng **FSRS** (`ts-fsrs`)
- [ ] 3 dạng bài: **flashcard, trắc nghiệm, điền chỗ trống bằng câu gốc**
- [ ] Nhắc ôn hằng ngày
- [ ] **Streak + thẻ đóng băng**, thống kê đơn giản (số từ đã thuộc)
- [ ] Cá nhân hóa **tối thiểu**: mục tiêu mỗi ngày, giờ nhắc, bật/tắt dạng bài

→ Chừng này đã đủ thành một sản phẩm dùng được và khác biệt với đối thủ.

### 🟡 Giai đoạn 2: Sau khi có người dùng thật (khoảng 50–100 người dùng thường xuyên)

- [ ] Gõ chính tả, nghe phát âm
- [ ] **Highlight từ đã lưu khi lướt web** (đáng làm nhất ở nhóm này)
- [ ] XP, cấp độ, huy hiệu
- [ ] Báo cáo tuần
- [ ] Gom từ theo deck/tag
- [ ] Tùy chỉnh mức độ ghi nhớ mong muốn (desired retention)

### 🔴 Chưa nên làm

Tốn công, phức tạp, chưa chứng minh được giá trị.

- Bảng xếp hạng, giải đấu, học cùng bạn bè (cần lượng người dùng lớn mới có ý nghĩa)
- AI chấm câu tự đặt (tốn chi phí API, khó chấm cho đúng)
- Chia sẻ bộ từ, app mobile
- Shop đổi điểm, theme, sticker
- Gợi ý giờ học bằng phân tích hành vi

---

## 9. Nguyên tắc chọn tính năng

Trước khi thêm bất kỳ tính năng nào, tự hỏi 3 câu:

1. Nó có giúp người dùng **nhớ từ lâu hơn** không?
2. Nó có giúp họ **quay lại học** không?
3. Có **đo được** hiệu quả của nó không? (tỉ lệ quay lại sau 7 ngày, số từ được ôn mỗi ngày, …)

→ Không trả lời "có" được ít nhất một câu thì **để sau**.

---

## 10. Tài liệu tham khảo

- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*.
- Deci, E. L. (1971). Effects of externally mediated rewards on intrinsic motivation. *Journal of Personality and Social Psychology*.
- Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits: Human needs and the self-determination of behavior. *Psychological Inquiry*.
- Ebbinghaus, H. (1885). *Über das Gedächtnis* (Memory: A Contribution to Experimental Psychology).
- Fogg, B. J. (2009). A behavior model for persuasive design. *Persuasive Technology Conference*.
- Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. *American Psychologist*.
- Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. *Econometrica*.
- Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected. *Journal of Marketing Research*.
- Lepper, M. R., Greene, D., & Nisbett, R. E. (1973). Undermining children's intrinsic interest with extrinsic reward. *Journal of Personality and Social Psychology*.
- Nunes, J. C., & Drèze, X. (2006). The endowed progress effect. *Journal of Consumer Research*.
- Paivio, A. (1971). *Imagery and Verbal Processes*.
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*.
- Rogers, T. B., Kuiper, N. A., & Kirker, W. S. (1977). Self-reference and the encoding of personal information. *Journal of Personality and Social Psychology*.
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*.
- Slamecka, N. J., & Graf, P. (1978). The generation effect: Delineation of a phenomenon. *Journal of Experimental Psychology: Human Learning and Memory*.
- Tulving, E., & Thomson, D. M. (1973). Encoding specificity and retrieval processes in episodic memory. *Psychological Review*.
- Ye, J. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *KDD '22*. Thư viện: [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
