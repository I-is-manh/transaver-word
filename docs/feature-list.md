# Transaver Word: Danh sách chức năng

> Danh sách đầy đủ các chức năng của sản phẩm, chia theo mức ưu tiên. Lý do và cơ sở khoa học của từng chức năng xem trong [product-plan.md](product-plan.md).
>
> Ngày soạn: 08/11/2026

---

## Cách đọc

| Ký hiệu | Mức ưu tiên | Khi nào làm |
|---|---|---|
| 🔴 **Must** | Bắt buộc có (MVP) | Thiếu là app mất ý nghĩa hoặc không phát hành được |
| 🟡 **Good** | Nên có | Sau khi có người dùng thật (khoảng 50–100 người dùng thường xuyên) |
| ⚪ **Later** | Để sau | Tốn công, cần nhiều người dùng hoặc chưa chứng minh được giá trị |

✅ = đã có trong code extension hiện tại.

---

## Mục lục

1. [Extension: dịch và lưu từ](#1-extension-dịch-và-lưu-từ)
2. [Tài khoản và đồng bộ](#2-tài-khoản-và-đồng-bộ)
3. [Quản lý từ vựng](#3-quản-lý-từ-vựng)
4. [Ôn tập và bài tập](#4-ôn-tập-và-bài-tập)
5. [Onboarding và cá nhân hóa](#5-onboarding-và-cá-nhân-hóa)
6. [Nhắc học](#6-nhắc-học)
7. [Động lực và phần thưởng](#7-động-lực-và-phần-thưởng)
8. [Thống kê](#8-thống-kê)
9. [Quyền riêng tư và bảo mật](#9-quyền-riêng-tư-và-bảo-mật)
10. [Dịch, AI và kiểm soát chi phí](#10-dịch-ai-và-kiểm-soát-chi-phí)
11. [Đo lường và góp ý](#11-đo-lường-và-góp-ý)
12. [Vận hành (admin)](#12-vận-hành-admin)
13. [Các màn hình của web app](#13-các-màn-hình-của-web-app)
14. [Những việc cần chốt trước khi code](#14-những-việc-cần-chốt-trước-khi-code)
15. [Tổng hợp MVP](#15-tổng-hợp-mvp)

---

## 1. Extension: dịch và lưu từ

| Chức năng | Mô tả | Mức |
|---|---|---|
| Bôi đen → dịch | Hiện icon cạnh vùng chọn, bấm icon thì dịch | ✅ 🔴 Must |
| Chọn cặp ngôn ngữ | Hơn 30 ngôn ngữ, tự nhận diện ngôn ngữ nguồn, nút đổi chiều | ✅ 🔴 Must |
| Đọc to, sao chép bản dịch | | ✅ 🔴 Must |
| Popup dịch nhanh | Ô nhập text trong popup, bật/tắt icon khi bôi đen | ✅ 🔴 Must |
| Sáng/tối theo hệ điều hành | | ✅ 🔴 Must |
| **Nút "Lưu" trong khung dịch** | Lưu từ kèm câu chứa từ, tiêu đề trang, link | 🔴 Must |
| Nghĩa theo ngữ cảnh | AI chọn nghĩa đúng với câu đang đọc, thay vì cả danh sách nghĩa | 🔴 Must |
| Phiên âm, từ loại, phát âm | Lấy từ từ điển khi lưu | 🔴 Must |
| Báo "đã lưu rồi" | Từ đã có trong kho thì hiện trạng thái, bấm Lưu lần nữa sẽ thêm ngữ cảnh mới | 🔴 Must |
| Lưu offline | Lưu vào IndexedDB khi mất mạng hoặc chưa đăng nhập, đồng bộ sau | 🔴 Must |
| Phím tắt lưu nhanh | Ví dụ `Alt+S` để lưu từ đang bôi đen | 🟡 Good |
| Side panel ôn nhanh | Ôn 5 thẻ ngay trong trình duyệt, không cần mở web app | 🟡 Good |
| **Highlight từ đã lưu khi lướt web** | Trang có từ đã lưu thì gạch chân, di chuột vào để tự kiểm tra | 🟡 Good |
| Tắt extension theo trang | Không hiện icon hay highlight trên một số trang do người dùng chọn | 🟡 Good |
| Lưu cụm từ, thành ngữ | Hỗ trợ lưu cả cụm nhiều từ, không chỉ một từ | 🟡 Good |
| Ảnh minh họa cho từ | Tự gợi ý ảnh hoặc cho người dùng chọn | ⚪ Later |
| Hỗ trợ Firefox, Edge | | ⚪ Later |

---

## 2. Tài khoản và đồng bộ

| Chức năng | Mô tả | Mức |
|---|---|---|
| Đăng nhập Google | Một chạm, không cần mật khẩu | 🔴 Must |
| **Dùng thử không cần tài khoản** | Lưu từ vào máy trước. Khi đăng nhập thì đẩy toàn bộ lên server | 🔴 Must |
| Đồng bộ extension ↔ web app | Dùng chung một kho từ, một lịch ôn | 🔴 Must |
| Xử lý xung đột khi đồng bộ | Ôn ở 2 nơi khi mất mạng: gộp theo `review_logs`, không ghi đè | 🔴 Must |
| Đăng xuất | | 🔴 Must |
| Đăng nhập bằng email (magic link) | Cho người không dùng Google | 🟡 Good |
| Đồng bộ nhiều trình duyệt / máy | | 🟡 Good |

---

## 3. Quản lý từ vựng

| Chức năng | Mô tả | Mức |
|---|---|---|
| **Danh sách từ đã lưu** | Xem toàn bộ từ, phân trang | 🔴 Must |
| Tìm kiếm từ | | 🔴 Must |
| Sửa nghĩa, sửa ghi chú | Khi AI chọn nghĩa chưa đúng | 🔴 Must |
| Xóa từ | | 🔴 Must |
| **Đánh dấu "đã biết"** | Bỏ từ khỏi lịch ôn nhưng vẫn giữ trong kho | 🔴 Must |
| **Một từ, nhiều ngữ cảnh** | Lưu cùng một từ ở nhiều trang sẽ gộp vào 1 thẻ có nhiều câu ngữ cảnh | 🔴 Must |
| Xem chi tiết từ | Các câu ngữ cảnh, link nguồn, lịch sử ôn, mức thuộc | 🔴 Must |
| Lọc và sắp xếp | Theo mức thuộc, ngày lưu, từ "khó" | 🟡 Good |
| Bộ từ (deck) và tag | Tự tạo hoặc tự động nhóm theo website / chủ đề | 🟡 Good |
| Thêm từ thủ công | Nhập từ không qua extension | 🟡 Good |
| Xóa / gắn tag hàng loạt | | 🟡 Good |
| Xuất dữ liệu (CSV, Anki) | | 🟡 Good |
| Nhập dữ liệu từ Anki, Quizlet, CSV | | ⚪ Later |
| Chia sẻ bộ từ | | ⚪ Later |

---

## 4. Ôn tập và bài tập

| Chức năng | Mô tả | Mức |
|---|---|---|
| Lịch ôn bằng FSRS | Dùng thư viện có sẵn, không tự viết thuật toán | 🔴 Must |
| Buổi ôn hằng ngày | Trộn từ đến hạn ôn và từ mới theo mục tiêu mỗi ngày | 🔴 Must |
| Dạng bài **flashcard** | Lật thẻ, tự chấm 4 mức (Quên / Khó / Được / Dễ) | 🔴 Must |
| Dạng bài **trắc nghiệm 4 đáp án** | Anh → Việt | 🔴 Must |
| Dạng bài **điền chỗ trống bằng câu gốc** | Dùng chính câu người dùng đã đọc. Điểm khác biệt của sản phẩm | 🔴 Must |
| Tự nâng cấp dạng bài | Mức thuộc 0–5: từ mới thì trắc nghiệm, từ đã khá thuộc thì phải gõ | 🔴 Must |
| Ghi `review_logs` cho mỗi lần ôn | Thời điểm, dạng bài, kết quả, thời gian trả lời | 🔴 Must |
| Màn hình kết thúc buổi ôn | Số từ đã ôn, số câu đúng, thời gian | 🔴 Must |
| Phím tắt khi ôn | Phím số để chọn đáp án, phím cách để lật thẻ | 🟡 Good |
| Dạng bài **nghe** | Nghe phát âm rồi chọn nghĩa | 🟡 Good |
| Dạng bài **trắc nghiệm ngược** | Việt → Anh | 🟡 Good |
| Dạng bài **gõ chính tả** | Nghe rồi gõ lại | 🟡 Good |
| Ôn riêng từ "khó" | Những từ sai nhiều lần, có đổi dạng bài | 🟡 Good |
| Ôn thêm ngoài lịch | Học trước, ôn lại một deck bất kỳ | 🟡 Good |
| **Chống dồn ứ** | Ngày có quá nhiều từ đến hạn thì tự giãn bớt, tạm ngưng thêm từ mới | 🟡 Good |
| Dạng bài **ghép cặp có tính giờ** | Mini game | ⚪ Later |
| Dạng bài **tự đặt câu, AI chấm** | | ⚪ Later |

---

## 5. Onboarding và cá nhân hóa

### 5.1. Onboarding

Hỏi 3 câu rồi tự tạo cấu hình ban đầu. Người dùng sửa lại được bất cứ lúc nào.

| Câu hỏi | Lựa chọn | Quyết định cài đặt |
|---|---|---|
| Học để làm gì? | Thi chứng chỉ · Công việc · Đọc báo, giải trí · Giao tiếp, du lịch | Mức ghi nhớ mong muốn, mức game hóa |
| Trình độ? | Mới bắt đầu · Trung cấp · Khá trở lên | Thông tin hiện trên thẻ, độ khó bài tập |
| Mỗi ngày rảnh bao lâu? | 5 · 10 · 20 phút | Số từ mới mỗi ngày (khoảng 3–4 / 7 / 14 từ) |

Có nút **"Bỏ qua"**, khi đó dùng mặc định: Đọc báo, Trung cấp, 10 phút.

Mỗi cài đặt lưu kèm nguồn gốc (`onboarding`, `user` hoặc `adaptive`). Cài đặt người dùng đã tự sửa thì app không tự đổi nữa, chỉ gợi ý.

| Chức năng | Mức |
|---|---|
| Onboarding 3 câu hỏi | 🔴 Must |
| Hướng dẫn lần đầu dùng extension (bôi đen → Lưu) | 🔴 Must |

### 5.2. Người dùng tự chỉnh

| Chức năng | Mức |
|---|---|
| Mục tiêu mỗi ngày: số từ mới, số phút | 🔴 Must |
| Giờ nhắc học | 🔴 Must |
| Bật/tắt từng dạng bài | 🔴 Must |
| Giao diện sáng/tối | 🔴 Must |
| Mức ghi nhớ mong muốn (85% / 90% / 95%) | 🟡 Good |
| Thông tin hiện trên thẻ: phiên âm, ảnh, nghĩa tiếng Anh | 🟡 Good |
| Mức game hóa: đầy đủ → tối giản | 🟡 Good |
| Cỡ chữ | 🟡 Good |
| Ngôn ngữ giao diện (Việt / Anh) | 🟡 Good |

### 5.3. App tự thích nghi

| Chức năng | Mức |
|---|---|
| FSRS tự học tốc độ quên của từng người | 🔴 Must (có sẵn trong thuật toán) |
| Gợi ý tăng/giảm số từ mới theo thời gian học thực tế và tỉ lệ đúng | 🟡 Good |
| Tối ưu tham số FSRS theo lịch sử ôn của từng người | 🟡 Good |
| Gợi ý giờ học theo giờ người dùng hay học | ⚪ Later |

---

## 6. Nhắc học

| Chức năng | Mô tả | Mức |
|---|---|---|
| Thông báo trình duyệt | Qua extension, đúng giờ đã đặt | 🔴 Must |
| Email nhắc hằng ngày | Có link mở thẳng vào buổi ôn | 🔴 Must |
| Không nhắc khi đã học xong hôm nay | | 🔴 Must |
| Tắt nhắc, đổi giờ nhắc | | 🔴 Must |
| Badge số từ cần ôn trên icon extension | | 🟡 Good |
| Cam kết giờ học | Kiểu "Tôi sẽ học lúc 21h sau khi ăn tối" | 🟡 Good |
| Nhắc qua Telegram | | ⚪ Later |
| Push notification trên điện thoại | | ⚪ Later |

Nội dung nhắc phải tích cực. **Không dùng thông báo đe dọa, gây cảm giác tội lỗi.**

---

## 7. Động lực và phần thưởng

| Chức năng | Mô tả | Mức |
|---|---|---|
| **Streak** | Số ngày học liên tiếp | 🔴 Must |
| **Thẻ đóng băng streak** | Nghỉ một ngày không mất chuỗi | 🔴 Must |
| Thanh tiến độ trong ngày | Bắt đầu ở 10–20%, hiện "còn 3 từ nữa là xong" | 🔴 Must |
| XP và cấp độ | Phản ánh kỹ năng thật, ví dụ "Đã thuộc vững 250 từ" | 🟡 Good |
| Huy hiệu bất ngờ | Ví dụ "Lưu từ từ 10 trang web khác nhau" | 🟡 Good |
| Báo cáo tuần | "Tuần này bạn thuộc thêm 32 từ" | 🟡 Good |
| Mở khóa theme, giọng đọc | | ⚪ Later |
| Đổi điểm lấy ngày dùng Premium | | ⚪ Later |
| Học cùng bạn bè, giải đấu theo nhóm | | ⚪ Later |
| Bảng xếp hạng | Nếu làm thì không bật mặc định | ⚪ Later |

Nguyên tắc: **thưởng cho việc nhớ đúng**, không thưởng cho việc bấm nhanh cho xong.

---

## 8. Thống kê

| Chức năng | Mô tả | Mức |
|---|---|---|
| Số từ đã lưu, đang học, đã thuộc | | 🔴 Must |
| Số từ cần ôn hôm nay | | 🔴 Must |
| Heatmap các ngày học | Kiểu GitHub | 🟡 Good |
| Biểu đồ số từ thuộc theo thời gian | | 🟡 Good |
| Dự báo số từ đến hạn ôn 7 ngày tới | | 🟡 Good |
| Tỉ lệ nhớ đúng | | 🟡 Good |
| Top website lưu nhiều từ nhất | | ⚪ Later |

---

## 9. Quyền riêng tư và bảo mật

App lưu câu và link của trang người dùng đang đọc, tức là chạm vào lịch sử duyệt web. Phần này **bắt buộc** để được duyệt lên Chrome Web Store.

| Chức năng | Mô tả | Mức |
|---|---|---|
| **Chính sách quyền riêng tư** | Trang công khai, khai báo trên Chrome Web Store | 🔴 Must |
| Chỉ lưu khi người dùng bấm "Lưu" | Không tự thu thập nội dung trang | 🔴 Must |
| Không hoạt động ở tab ẩn danh | Trừ khi người dùng tự bật | 🔴 Must |
| **Xóa tài khoản và toàn bộ dữ liệu** | | 🔴 Must |
| Xin quyền tối thiểu trong manifest | Chỉ xin quyền thật sự cần | 🔴 Must |
| HTTPS, token có hạn và refresh token | | 🔴 Must |
| Giới hạn số request (rate limit) | Chống lạm dụng API | 🔴 Must |
| Tải về toàn bộ dữ liệu cá nhân | | 🟡 Good |
| Tùy chọn không lưu link nguồn | Chỉ lưu câu, không lưu URL | 🟡 Good |

---

## 10. Dịch, AI và kiểm soát chi phí

| Chức năng | Mô tả | Mức |
|---|---|---|
| Cache bản dịch | Đã có cache trong extension | ✅ 🔴 Must |
| Đổi dịch vụ dịch | MyMemory miễn phí chỉ khoảng 5000 lượt/ngày cho mỗi IP, không đủ khi có nhiều người dùng | 🔴 Must |
| Gọi dịch và AI qua backend | Không để API key trong extension | 🔴 Must |
| Cache nghĩa theo ngữ cảnh | Cùng từ và câu tương tự thì dùng lại kết quả, không gọi AI lại | 🔴 Must |
| Giới hạn số lượt AI mỗi user mỗi ngày | | 🔴 Must |
| Phương án dự phòng | AI lỗi hoặc hết lượt thì lấy nghĩa từ từ điển | 🔴 Must |
| Theo dõi chi phí AI theo ngày | | 🟡 Good |
| Giọng đọc chất lượng cao (TTS) | | 🟡 Good |

---

## 11. Đo lường và góp ý

| Chức năng | Mô tả | Mức |
|---|---|---|
| **Ghi sự kiện cơ bản** | Lưu từ, bắt đầu/kết thúc buổi ôn, mở app từ thông báo | 🔴 Must |
| Chỉ số chính | Tỉ lệ quay lại sau 1 / 7 / 30 ngày, số từ ôn mỗi ngày, số từ lưu mỗi tuần | 🔴 Must |
| **Nút "Góp ý / Báo lỗi"** | Trong extension và web app | 🔴 Must |
| Theo dõi lỗi | Ghi lỗi JavaScript và lỗi backend | 🔴 Must |
| Khảo sát ngắn trong app | | 🟡 Good |
| A/B test | | ⚪ Later |

Không có số liệu thì không quyết được làm gì ở giai đoạn 2, nên phần đo lường phải có ngay từ MVP.

---

## 12. Vận hành (admin)

| Chức năng | Mô tả | Mức |
|---|---|---|
| Xem số người dùng, số từ lưu, số buổi ôn theo ngày | | 🟡 Good |
| Xem và trả lời góp ý | | 🟡 Good |
| Theo dõi chi phí dịch / AI | | 🟡 Good |
| Khóa tài khoản lạm dụng | | 🟡 Good |
| Gửi thông báo cho toàn bộ người dùng | | ⚪ Later |

Giai đoạn đầu có thể xem trực tiếp trong database, chưa cần làm trang admin.

---

## 13. Các màn hình của web app

| Màn hình | Nội dung | Mức |
|---|---|---|
| Đăng nhập | | 🔴 Must |
| Onboarding | 3 câu hỏi | 🔴 Must |
| Trang chủ | Số từ cần ôn hôm nay, streak, nút "Bắt đầu ôn" | 🔴 Must |
| Buổi ôn | Làm bài tập, màn hình kết thúc | 🔴 Must |
| Danh sách từ | Tìm kiếm, sửa, xóa, đánh dấu đã biết | 🔴 Must |
| Chi tiết từ | Ngữ cảnh, lịch sử ôn | 🔴 Must |
| Thống kê | | 🔴 Must |
| Cài đặt | Mục tiêu, nhắc học, dạng bài, tài khoản, xóa dữ liệu | 🔴 Must |
| Chính sách quyền riêng tư | | 🔴 Must |
| **Giao diện dùng tốt trên điện thoại** | Để ôn được khi bấm link trong email nhắc | 🔴 Must |
| Trang giới thiệu sản phẩm (landing page) | | 🟡 Good |
| Quản lý deck | | 🟡 Good |
| Báo cáo tuần | | 🟡 Good |
| App mobile riêng | | ⚪ Later |

---

## 14. Những việc cần chốt trước khi code

| Vấn đề | Vì sao cần chốt sớm |
|---|---|
| **Một từ có nhiều ngữ cảnh** | Quyết định cấu trúc database. Đề xuất thêm bảng `word_contexts`, quan hệ 1 `user_words` – nhiều `word_contexts` |
| **MVP chỉ cho tiếng Anh hay mọi ngôn ngữ** | Extension dịch được hơn 30 ngôn ngữ, nhưng phiên âm, từ điển và bài tập trong plan đang viết cho Anh → Việt |
| **FSRS chạy ở đâu** | Plan chọn `ts-fsrs` (TypeScript) nhưng backend là Laravel (PHP). Chọn: tính ở client rồi gửi lên, hoặc dùng bản FSRS cho PHP ở backend |
| **Dịch vụ dịch và AI** | Ảnh hưởng chi phí và giới hạn số lượt |
| **Mô hình kinh doanh** | Chưa cần làm, nhưng cần biết chức năng nào sẽ tính phí để thiết kế giới hạn ngay từ đầu |

---

## 15. Tổng hợp MVP

Các chức năng 🔴 Must gom lại:

**Extension**
- [ ] Nút "Lưu" kèm câu ngữ cảnh, tiêu đề trang, link
- [ ] Nghĩa theo ngữ cảnh, phiên âm, phát âm
- [ ] Báo từ đã lưu, thêm ngữ cảnh mới cho từ cũ
- [ ] Lưu offline, đồng bộ khi có mạng

**Tài khoản**
- [ ] Đăng nhập Google, dùng thử không cần tài khoản
- [ ] Đồng bộ extension ↔ web app, xử lý xung đột

**Từ vựng và ôn tập**
- [ ] Danh sách từ: tìm, sửa, xóa, đánh dấu đã biết
- [ ] FSRS + 3 dạng bài: flashcard, trắc nghiệm, điền chỗ trống bằng câu gốc
- [ ] Ghi `review_logs` đầy đủ

**Cá nhân hóa và động lực**
- [ ] Onboarding 3 câu hỏi
- [ ] Mục tiêu mỗi ngày, giờ nhắc, bật/tắt dạng bài
- [ ] Nhắc học qua thông báo trình duyệt và email
- [ ] Streak + thẻ đóng băng, thanh tiến độ trong ngày
- [ ] Thống kê cơ bản

**Nền tảng**
- [ ] Chính sách quyền riêng tư, xóa tài khoản, không chạy ở tab ẩn danh
- [ ] Gọi dịch/AI qua backend, cache, giới hạn lượt, phương án dự phòng
- [ ] Ghi sự kiện đo lường, nút góp ý, theo dõi lỗi
- [ ] Web app dùng tốt trên điện thoại
