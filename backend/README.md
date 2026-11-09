# Transaver Word: Backend

API cho extension và web app của Transaver Word: tài khoản, lưu từ, ôn tập (FSRS), thống kê, nhắc học, deck, huy hiệu và admin.

- Hợp đồng API: [docs/api-contract.md](../docs/api-contract.md)
- Thiết kế database: [docs/database-redesign.html](../docs/database-redesign.html)

## Công nghệ

Laravel 12, PHP 8.3, PostgreSQL 16 (chạy bằng Docker), Laravel Sanctum (token). Cache, queue, session và rate limiter dùng driver `database`, không cần Redis.

## Yêu cầu

- PHP 8.3 với các extension `pdo_pgsql`, `pgsql`, `mbstring`, `intl`, `xml`, `curl`, `bcmath`. Trên Ubuntu:

  ```bash
  sudo apt install php8.3-pgsql php8.3-mbstring php8.3-intl php8.3-xml php8.3-curl php8.3-bcmath
  ```

- Composer 2
- Docker (để chạy PostgreSQL)
- Node 18+ (chỉ cần khi sinh lại dữ liệu chuẩn cho test FSRS, xem bên dưới)

## Cài đặt lần đầu

### 1. Tạo PostgreSQL bằng Docker

```bash
docker run -d --name transaver-postgres --restart unless-stopped \
  -e POSTGRES_USER=transaver \
  -e POSTGRES_PASSWORD=doi_mat_khau_local \
  -e POSTGRES_DB=transaver \
  -p 127.0.0.1:5432:5432 \
  -v transaver-pgdata:/var/lib/postgresql/data \
  postgres:16

# Database riêng cho test
docker exec transaver-postgres psql -U transaver -d transaver -c "CREATE DATABASE transaver_test;"
```

Cổng chỉ mở cho máy local (`127.0.0.1`). Dữ liệu nằm trong volume `transaver-pgdata`, xóa container không mất dữ liệu.

### 2. Cài thư viện và cấu hình

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Mở `.env`, đặt `DB_PASSWORD` bằng mật khẩu đã dùng ở bước 1.

### 3. Tạo bảng và dữ liệu mẫu

```bash
php artisan migrate:fresh --seed
```

Lệnh này tạo bảng, nạp 9 huy hiệu và 2 tài khoản (mật khẩu đều là `password123`):

| Email | Quyền |
|---|---|
| `demo@transaver.local` | user |
| `admin@transaver.local` | admin |
| `superadmin@transaver.local` | superadmin |

Muốn tài khoản demo có sẵn dữ liệu học (60 từ, 45 ngày ôn, streak, deck, huy hiệu, thùng rác) để thử màn hình thống kê:

```bash
php artisan db:seed --class=DemoDataSeeder
```

Seeder này chạy lại được: mỗi lần chạy sẽ xóa dữ liệu học cũ của `demo@transaver.local` rồi sinh lại. Không gọi mạng.

## Chạy

```bash
php artisan serve                 # API ở http://localhost:8000/api
php artisan queue:work --tries=3  # queue worker: GỬI EMAIL (xác nhận email, nhắc học, báo cáo tuần), để một terminal riêng
php artisan schedule:work         # chạy các tác vụ định kỳ (xem bên dưới), để một terminal riêng
```

### Queue gửi email

Không email nào được gửi ngay trong request hay trong scheduler. Mọi Mailable (`app/Mail`) đều `ShouldQueue`: request hoặc lệnh định kỳ chỉ đẩy job vào bảng `jobs` (driver `database`), còn **queue worker chạy riêng** lấy job ra gửi qua SMTP. Lỗi SMTP thì job tự thử lại 3 lần (chờ 60 giây, rồi 300 giây); hết lượt thì job vào `failed_jobs` và email nhắc học / báo cáo tuần được ghi `failed` trong `notification_logs`.

- Local: `php artisan queue:work --tries=3` trong một terminal riêng. Sửa code trong `app/Mail` hay `.env` xong phải tắt worker rồi chạy lại (worker giữ code cũ trong bộ nhớ), hoặc dùng `php artisan queue:listen` khi đang sửa code.
- Xem job lỗi: `php artisan queue:failed`; gửi lại: `php artisan queue:retry all`.
- Production: chạy worker bằng Supervisor (hoặc systemd) để tự khởi động lại, và chạy `php artisan queue:restart` sau mỗi lần deploy. Ví dụ `/etc/supervisor/conf.d/transaver-worker.conf`:

```ini
[program:transaver-worker]
command=php /đường-dẫn/backend/artisan queue:work --tries=3 --max-time=3600
autostart=true
autorestart=true
numprocs=1
stopwaitsecs=60
user=www-data
redirect_stderr=true
stdout_logfile=/đường-dẫn/backend/storage/logs/worker.log
```

Thử nhanh:

```bash
curl -s -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -X POST http://localhost:8000/api/auth/login \
  -d '{"email":"demo@transaver.local","password":"password123"}'
```

Nếu máy bật Xdebug, mỗi lệnh `php` sẽ in cảnh báo "Could not connect to debugging client". Đặt `export XDEBUG_MODE=off` để tắt.

## Superadmin và "đăng nhập với tư cách"

Superadmin có mọi quyền của admin, cộng thêm quyền đăng nhập với tư cách người dùng khác để hỗ trợ (contract mục 9.1). Token impersonate hết hạn sau 2 giờ (`impersonation_minutes` trong `config/learning.php`). Mỗi lượt được ghi vào bảng `impersonation_logs`.

```bash
php artisan db:seed --class=SuperAdminSeeder   # tạo superadmin@transaver.local trên DB đang có dữ liệu (không tạo trùng)
php artisan user:superadmin ten@example.com    # nâng một tài khoản có sẵn thành superadmin
```

## Test

```bash
php artisan test
```

- Test chạy trên database `transaver_test` (cấu hình trong `phpunit.xml`).
- Test không gọi mạng thật: `Http::preventStrayRequests()` trong `tests/TestCase.php` chặn mọi request chưa được `Http::fake`.
- `tests/Unit/FsrsTest.php` so FSRS bản PHP với `ts-fsrs` 5.2.3 qua dữ liệu chuẩn `tests/Fixtures/fsrs.json`. Muốn sinh lại dữ liệu này:

  ```bash
  cd tools/fsrs-fixtures && npm install && npm run generate
  ```

Kiểm tra định dạng code: `./vendor/bin/pint --test` (sửa tự động: `./vendor/bin/pint`).

## Tác vụ định kỳ

Khai báo trong `routes/console.php`. Trên server thật, thêm một dòng cron chạy mỗi phút: `* * * * * cd /đường/dẫn/backend && php artisan schedule:run`.

| Lệnh | Lịch | Việc |
|---|---|---|
| `php artisan words:purge-trash` | Hằng ngày 03:00 | Xóa hẳn từ nằm trong thùng rác quá `trash_days` (30) ngày |
| `php artisan reminders:send` | Mỗi 15 phút | Email nhắc học cho người bật kênh email, đã qua giờ nhắc, hôm nay chưa ôn |
| `php artisan reports:weekly` | Mỗi giờ | Email báo cáo tuần vào sáng thứ Hai từ 08:00 theo giờ của từng người |

Các lệnh trên chạy tay được bất cứ lúc nào. `notification_logs` bảo đảm mỗi người chỉ nhận một email mỗi loại mỗi ngày.

## Cấu hình nghiệp vụ

Các con số về việc học nằm trong [config/learning.php](config/learning.php): số ngày giữ thùng rác, ngưỡng "đã thuộc", ngưỡng "từ khó", luật thẻ đóng băng, XP mỗi mức đánh giá, công thức cấp độ, bước học của FSRS. Sửa ở đây, không phải sửa code.

## Cấu trúc chính

```
app/
├── Actions/            CreateUser, SaveWord (6 bước lưu từ)
├── Contracts/          ContextMeaningService: chỗ cắm AI
├── Fsrs/               FSRS-6 viết bằng PHP (port từ ts-fsrs)
├── Http/Controllers/Api/   Một controller cho mỗi nhóm endpoint
├── Services/           Từ điển, ôn tập (Review/), tiến độ/streak/XP, huy hiệu, báo cáo, AI
└── Console/Commands/   Ba tác vụ định kỳ
database/seeders/       AchievementSeeder, DatabaseSeeder, DemoDataSeeder
tools/fsrs-fixtures/    Script Node sinh dữ liệu chuẩn cho test FSRS
```

## Phần để trống cho chủ sản phẩm

Các phần cần API key bí mật chưa được làm. Code đã chừa sẵn chỗ.

### Nghĩa theo ngữ cảnh bằng AI

Hiện tại app không gọi AI. Người dùng chọn nghĩa trong từ điển, hoặc dùng bản dịch extension gửi kèm.

Cách cắm:

1. Viết class implement `App\Contracts\ContextMeaningService`. Docblock trong [app/Contracts/ContextMeaningService.php](app/Contracts/ContextMeaningService.php) có hướng dẫn chi tiết.
2. Khai báo class trong `config/services.php` → `ai.providers`, ví dụ `'anthropic' => App\Services\Ai\AnthropicContextMeaningService::class`.
3. Đặt trong `.env`: `AI_PROVIDER=anthropic`, `AI_API_KEY=...`, `AI_MODEL=...`.

Không cần sửa chỗ khác. `ContextMeaningResolver` đã lo phần cache (bảng `context_meaning_cache`, khóa băm nên không lưu câu gốc) và bắt lỗi: AI lỗi thì lưu từ vẫn chạy, nghĩa lấy từ bản dịch. Nghĩa do AI trả về được lưu với `meaning_source = "ai"`. Nên thêm giới hạn số lượt gọi mỗi ngày cho mỗi người (`RateLimiter`) trong class provider để kiểm soát chi phí.

### Đăng nhập Google

**Đã có** (09/11/2026), xem `docs/api-contract.md` mục 2.6 và `app/Http/Controllers/GoogleAuthController.php`.

1. Trong Google Cloud Console → OAuth client (loại Web application) → **Authorized redirect URIs** thêm đúng `GOOGLE_REDIRECT_URI`, ví dụ `http://localhost:8000/auth/google/callback`. Lên production thì thêm địa chỉ thật.
2. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` trong `.env`; `FRONTEND_URL` là nơi backend chuyển về sau khi đăng nhập. Đổi `.env` xong chạy `php artisan config:clear`.
3. Luồng: web mở `/auth/google/redirect` → Google → `/auth/google/callback` → chuyển về `FRONTEND_URL/auth/google/callback?code=…` → web gọi `POST /api/auth/google/exchange`. Mã một lần sống 120 giây.
4. Tài khoản tạo bằng Google không có mật khẩu (`users.password` = null, `User.has_password = false`): xóa tài khoản bằng cách nhập lại email. Tài khoản email/mật khẩu có sẵn cùng email được liên kết tự động.

### Gửi email thật

Hiện `MAIL_MAILER=log`: email được ghi vào `storage/logs/laravel.log` thay vì gửi đi. Muốn gửi thật, đổi sang một dịch vụ email (ví dụ SMTP của Brevo, hoặc Resend), điền các biến `MAIL_*` tương ứng trong `.env` và đặt `MAIL_FROM_ADDRESS` là địa chỉ đã xác minh với dịch vụ đó. Nội dung email nằm ở `app/Mail` và `resources/views/mail`.
