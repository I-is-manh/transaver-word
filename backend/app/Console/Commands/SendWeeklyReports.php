<?php

namespace App\Console\Commands;

use App\Mail\WeeklyReportMail;
use App\Models\User;
use App\Services\ReportService;
use App\Support\UserSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Gửi email báo cáo tuần (contract mục 8.2): sáng thứ Hai từ 08:00 theo múi giờ người dùng,
 * chỉ khi weekly_report = true và tuần trước có hoạt động. Chạy mỗi giờ; notification_logs chặn gửi trùng.
 */
class SendWeeklyReports extends Command
{
    protected $signature = 'reports:weekly';

    protected $description = 'Gửi email báo cáo tuần vào sáng thứ Hai theo giờ của người dùng';

    public function handle(ReportService $reports): int
    {
        $sent = 0;

        User::where('status', User::STATUS_ACTIVE)->chunkById(200, function ($users) use ($reports, &$sent) {
            foreach ($users as $user) {
                if ($this->send($user, $reports)) {
                    $sent++;
                }
            }
        });

        $this->info("Đã gửi {$sent} báo cáo tuần.");

        return self::SUCCESS;
    }

    private function send(User $user, ReportService $reports): bool
    {
        if (! UserSettings::get($user, 'weekly_report')) {
            return false;
        }

        $local = Carbon::now($user->timezone ?: config('learning.default_timezone'));
        if (! $local->isMonday() || $local->hour < 8) {
            return false;
        }

        $report = $reports->weekly($user, $reports->lastFullWeekStart($user));
        if ($report['days_active'] === 0 && $report['words_saved'] === 0) {
            return false; // tuần trước không hoạt động: không gửi email trống
        }

        $forDate = $local->toDateString();
        $inserted = DB::table('notification_logs')->insertOrIgnore([
            'user_id' => $user->id, 'type' => 'weekly_report', 'for_date' => $forDate,
            'status' => 'sent', 'sent_at' => now(),
        ]);
        if ($inserted === 0) {
            return false;
        }

        try {
            // Đưa vào hàng đợi; worker (scheduler, mỗi phút) gửi thật. Lỗi gửi ghi qua WeeklyReportMail::failed().
            Mail::to($user->email)->queue(new WeeklyReportMail($user, $report, $forDate));

            return true;
        } catch (Throwable $e) {
            DB::table('notification_logs')
                ->where(['user_id' => $user->id, 'type' => 'weekly_report', 'for_date' => $forDate])
                ->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 500)]);
            report($e);

            return false;
        }
    }
}
