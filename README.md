# Transaver Word

Extension dịch và lưu từ vựng, giúp người dùng ôn lại từ mới bằng chính câu họ đã đọc.

> *Lưu từ một chạm, ôn lại bằng chính câu bạn đã đọc.*

## Cấu trúc repo

| Thư mục | Nội dung | Hướng dẫn |
|---|---|---|
| [`backend/`](backend/) | API Laravel 12 + PostgreSQL 16 + Sanctum | [backend/README.md](backend/README.md) |
| [`web/`](web/) | Web app React 18 + TypeScript + Vite | [web/README.md](web/README.md) |
| [`extension/`](extension/) | Chrome Extension MV3, JavaScript thuần | [extension/README.md](extension/README.md) |
| [`brand/`](brand/) | Logo, icon, token màu, hệ thống theme | [docs/theme-system.md](docs/theme-system.md) |
| [`docs/`](docs/) | Định hướng sản phẩm, chức năng, database, hợp đồng API | Xem bảng dưới |

## Chạy nhanh trên máy local

Yêu cầu: PHP 8.3 + `php8.3-pgsql`, Composer, Node 22, Docker.

```bash
# 1. Database (lần đầu: xem lệnh docker run trong backend/README.md)
docker start transaver-postgres

# 2. Backend → http://localhost:8000
cd backend
export XDEBUG_MODE=off
php artisan migrate:fresh --seed                   # tạo tài khoản demo + admin
php artisan db:seed --class=DemoDataSeeder         # dữ liệu học mẫu cho tài khoản demo
php artisan serve
php artisan queue:work --tries=3                   # terminal riêng: queue worker gửi email

# 3. Web app → http://localhost:5173
cd web
npm install
VITE_USE_MOCKS=false npm run dev                   # bỏ VITE_USE_MOCKS=false để dùng dữ liệu giả, không cần backend

# 4. Extension
#    chrome://extensions → bật Developer mode → Load unpacked → chọn thư mục extension/
#    Đăng nhập trên web app là extension tự nhận phiên (không có form đăng nhập trong popup)
```

| Tài khoản (backend thật) | Mật khẩu | Vai trò |
|---|---|---|
| `demo@transaver.local` | `password123` | Người dùng, có sẵn ~60 từ và 45 ngày lịch sử ôn |
| `admin@transaver.local` | `password123` | Quản trị |

## Kiểm tra

```bash
cd backend && php artisan test                                   # test backend
cd web && npm run typecheck && npm run lint && npm run build     # kiểm tra web
```

## Chưa làm, để chủ sản phẩm tự gắn (cần khóa bí mật)

| Phần | Chỗ đã chừa sẵn |
|---|---|
| Nghĩa theo ngữ cảnh bằng AI | Interface `App\Contracts\ContextMeaningService`, biến `AI_*`. Hướng dẫn trong `backend/README.md` |
| Gửi email thật (nhắc học, báo cáo tuần) | Đang dùng `MAIL_MAILER=log` (email ghi vào `backend/storage/logs/laravel.log`) |

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/product-plan.md](docs/product-plan.md) | Định hướng sản phẩm, cơ sở tâm lý học |
| [docs/final-decision-features.md](docs/final-decision-features.md) | 32 chức năng đã chốt |
| [docs/acceptance.md](docs/acceptance.md) | Nghiệm thu: chức năng nào đã làm, nằm ở đâu |
| [docs/api-contract.md](docs/api-contract.md) | Hợp đồng API giữa backend và web/extension |
| [docs/database-redesign.html](docs/database-redesign.html) | Thiết kế database |
| [docs/theme-system.md](docs/theme-system.md) | Hệ thống theme (đã thiết kế, chưa dev) |
| [docs/orchestration-plan.md](docs/orchestration-plan.md) | Cách chia việc khi dev |
| [docs/orchestrator-handoff.md](docs/orchestrator-handoff.md) | Trạng thái hiện tại, để session điều phối mới làm tiếp |
