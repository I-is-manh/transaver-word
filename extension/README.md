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

## Cấu trúc

```
extension/
├── manifest.json        # Manifest V3
├── icons/               # Icon PNG + logo chữ SVG (từ brand/)
├── fonts/               # Be Vietnam Pro, Lexend (woff2, đã cắt còn Latin + tiếng Việt) + giấy phép OFL
├── popup/               # Giao diện khi bấm icon trên thanh công cụ
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── src/
    ├── icons.js         # Bộ icon thương hiệu dạng SVG (dùng chung)
    ├── languages.js     # Danh sách ngôn ngữ + đọc/ghi cài đặt (dùng chung)
    ├── background.js    # Service worker: gọi API dịch, cache
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
