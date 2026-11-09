<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Dọn thùng rác hằng ngày (cần chạy `php artisan schedule:work` hoặc cron `schedule:run` mỗi phút).
Schedule::command('words:purge-trash')->dailyAt('03:00')->withoutOverlapping();

// Email nhắc học: mỗi 15 phút kiểm tra ai đã tới giờ nhắc (contract mục 6.3).
Schedule::command('reminders:send')->everyFifteenMinutes()->withoutOverlapping();

// Báo cáo tuần: chạy mỗi giờ, gửi khi ở múi giờ người dùng là sáng thứ Hai từ 08:00 (contract mục 8.2).
Schedule::command('reports:weekly')->hourly()->withoutOverlapping();

// Email KHÔNG gửi trong request hay trong scheduler: mọi Mailable đều ShouldQueue, job nằm trong bảng `jobs`
// và được một queue worker chạy riêng gửi đi (`php artisan queue:work`, xem backend/README.md).
