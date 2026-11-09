# Transaver Word: Web app

React 18 + TypeScript + Vite. Chạy ở `http://localhost:5173`.

## Chạy

```bash
cp .env.example .env.local   # lần đầu
npm install
npm run dev
```

| Biến                | Mặc định                    | Ý nghĩa                                       |
| ------------------- | --------------------------- | --------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | Địa chỉ backend                               |
| `VITE_USE_MOCKS`    | `true` trong `.env.example` | `true` = dữ liệu giả (MSW), không cần backend |

Mock có sẵn tài khoản `demo@transaver.vn` / `matkhau123` (60 ngày dữ liệu mẫu) , `admin@transaver.vn` / `matkhau123` (quản trị) và `superadmin@transaver.vn` / `matkhau123` (superadmin, có "Đăng nhập với tư cách"). Thử hết hạn phiên: `window.__tvExpireImpersonation()`. Dữ liệu giả lưu trong localStorage; xóa bằng `window.__tvResetMocks()` trong console.
Backend thật (seeder): `demo@transaver.local` / `password123`.

## Lệnh

`npm run typecheck` · `npm run lint` · `npm run build` · `npm run format`

## Quy ước

- Màu lấy từ `../brand/themes/themes.css` (import trong `src/main.tsx`). Component chỉ dùng token CSS (`var(--brand)`…), không viết mã màu. `<html data-tv-theme="teal">`, sáng/tối theo hệ điều hành.
- Font trong `public/fonts` (chép từ `extension/fonts`).
- API client: `src/api/` theo `docs/api-contract.md`. Lỗi 422 → `ApiError.errors` hiện cạnh ô nhập; 401 → xóa token, về `/login`.
- Mock MSW: `src/mocks/handlers.ts`, phủ mọi endpoint mục 1.7, 2, 3, 4 của contract.

## Màn hình

| Đường dẫn                              | Màn hình                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| `/register`, `/login`                  | Đăng ký, đăng nhập                                               |
| `/onboarding`                          | 3 câu hỏi, hiện sau khi đăng ký                                  |
| `/`                                    | Trang chủ: cần ôn hôm nay, Ôn ngay, streak, cấp độ, tổng quan    |
| `/review`                              | Buổi ôn (`?mode=hard`, `?mode=deck&deck_id=`), màn hình kết thúc |
| `/words`, `/words/:id`, `/words/trash` | Từ của tôi, chi tiết từ, thùng rác                               |
| `/decks`, `/decks/:id`                 | Deck                                                             |
| `/stats`                               | Thống kê, heatmap, biểu đồ, báo cáo tuần, huy hiệu               |
| `/settings`                            | Cài đặt, xóa tài khoản                                           |
| `/privacy`                             | Chính sách quyền riêng tư (công khai)                            |
| `/admin`                               | Quản trị (chỉ `role = admin`)                                    |

Phím tắt khi ôn: `Space` lật thẻ · `1`–`4` chọn đáp án / đánh giá · `Enter` Được hoặc Tiếp tục.
