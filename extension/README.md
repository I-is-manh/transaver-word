# Transaver Word: Chrome Extension

Bôi đen văn bản trên bất kỳ trang web nào → bấm icon → dịch sang ngôn ngữ bạn chọn.

## Cài đặt để chạy thử

1. Mở Chrome, vào `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Bấm **Load unpacked** → chọn thư mục `extension/` này
4. Mở một trang web bất kỳ (tab đã mở từ trước thì nhấn F5)

Sửa code xong: bấm nút ↻ của extension trong `chrome://extensions`, rồi F5 trang web.

## Tính năng hiện có

- Bôi đen văn bản → hiện icon cạnh vùng chọn → bấm icon mới dịch
- Hơn 30 ngôn ngữ, chọn được **A → B** bất kỳ, có chế độ **tự nhận diện** ngôn ngữ nguồn
- **Ghi nhớ cặp ngôn ngữ** đã chọn (lưu trong `chrome.storage.sync`, đồng bộ theo tài khoản Chrome)
- Đổi ngôn ngữ ngay trong khung dịch, nút ⇄ đổi chiều dịch
- Đọc to bản dịch, sao chép bản dịch
- Popup: chọn cặp ngôn ngữ, ô dịch nhanh (Ctrl+Enter), bật/tắt icon khi bôi đen
- Tự đổi giao diện sáng/tối theo hệ điều hành
- **Không có form đăng nhập riêng:** đăng nhập trên web app, extension tự kết nối theo (`src/web-bridge.js` đọc token của web app trên trang có `<meta name="transaver-web-app">`, mọi cổng localhost). Web đăng xuất thì extension cũng ngắt. Popup chỉ hiện trạng thái kết nối. Phiên lưu ở `chrome.storage.local['tvAuth']`; mọi lời gọi backend đi qua `background.js`
- **Lưu từ:** nút Lưu trong khung dịch gửi từ, câu chứa từ (≤ 500 ký tự, `word_offset`/`word_length` theo UTF-16), tiêu đề + link trang (bỏ khi tắt "Lưu link" trong Cài đặt web) và bản dịch đang hiện. Bấm Lưu là lưu luôn với nghĩa = bản dịch đang hiện (không có bước chọn nghĩa); đổi nghĩa sau ở trang chi tiết từ trên web
- **Gạch chân từ đã lưu** khi lướt web (CSS Custom Highlight API, không sửa DOM của trang). Dừng chuột trên từ khoảng 0,4 giây mới hiện thẻ "Bạn còn nhớ nghĩa?" + nút Hiện nghĩa; thẻ đứng yên tới khi bấm × (hoặc Esc / bấm ra ngoài thẻ). Bật/tắt trong popup
- **Nhắc học:** `chrome.alarms` vào giờ nhắc (theo múi giờ trong Cài đặt), hôm nay chưa học thì hiện thông báo, bấm mở trang ôn tập. Cài đặt, lịch nhắc và danh sách từ làm mới khi mở popup và mỗi 6 giờ

## Cấu trúc

```
extension/
├── manifest.json        # Manifest V3
├── icons/               # Icon PNG + logo chữ SVG (từ brand/)
├── fonts/               # Be Vietnam Pro, Lexend (woff2, đã cắt còn Latin + tiếng Việt) + giấy phép OFL
├── popup/               # Giao diện khi bấm icon trên thanh công cụ
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── account.js   # Trạng thái kết nối tài khoản
└── src/
    ├── config.js        # API_BASE_URL, WEB_APP_URL (sửa kèm host_permissions)
    ├── context.js       # Lấy câu chứa từ được bôi đen
    ├── web-bridge.js    # Lấy phiên đăng nhập từ web app
    ├── highlight.js     # Gạch chân từ đã lưu + thẻ tự kiểm tra
    ├── icons.js         # Bộ icon thương hiệu dạng SVG (dùng chung)
    ├── languages.js     # Danh sách ngôn ngữ + đọc/ghi cài đặt (dùng chung)
    ├── background.js    # Service worker: dịch, đăng nhập, lưu từ, đồng bộ, nhắc học
    └── content.js       # Icon + khung dịch trên trang (Shadow DOM)
```

## Bộ nhận diện

Màu, font và icon lấy từ thư mục [`brand/`](../brand/) ở gốc repo (`brand/tokens.json`):

- Màu chủ đạo Teal Mực `#0F6E66` (theme tối `#3CC4B4`); màu phụ Vàng Hoa Cúc `#F2A516` dành cho phần thưởng.
- Font: Be Vietnam Pro cho nội dung, Lexend cho tiêu đề. Đóng gói sẵn trong `fonts/` nên chạy được cả khi offline. Trên trang web, font nạp qua `web_accessible_resources`; trang nào chặn font ngoài thì tự quay về font hệ thống.
- Đổi màu: sửa token ở đầu `STYLES` trong `src/content.js` và ở `:root` trong `popup/popup.css`.

Không cần build: JavaScript thuần, nạp thẳng vào Chrome.

## API dịch

Hiện dùng **MyMemory** (`api.mymemory.translated.net`): miễn phí, không cần key, khoảng 5.000 lượt/ngày/IP, tối đa 500 ký tự mỗi lần.

**Hạn chế:** MyMemory dựa trên bộ nhớ dịch, nên đôi khi trả về kết quả lạ với từ đơn (ví dụ `ありがとう` → "(Vỗ tay)"). Muốn chất lượng tốt hơn thì thay bằng Google Translate, DeepL hoặc AI, gọi qua backend. Chỉ cần sửa hàm `translate()` trong `src/background.js`.
