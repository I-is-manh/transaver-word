<?php

namespace App\Console\Commands;

use App\Mail\DailyReminderMail;
use App\Models\User;
use App\Services\ProgressService;
use App\Support\UserSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Gửi email nhắc học (contract mục 6.3). Chạy mỗi 15 phút: người dùng bật kênh email, đã qua
 * giờ nhắc theo múi giờ của họ, hôm nay chưa ôn, chưa được nhắc hôm nay.
 */
class SendDailyReminders extends Command
{
    protected $signature = 'reminders:send';

    protected $description = 'Gửi email nhắc học cho người dùng đã tới giờ nhắc mà hôm nay chưa ôn';

    public function handle(ProgressService $progress): int
    {
        $sent = 0;

        User::query()
            ->where('status', User::STATUS_ACTIVE)
            ->whereHas('settings', fn ($q) => $q->whereRaw("settings->'reminder_channels'->'value' @> '[\"email\"]'::jsonb"))
            ->chunkById(200, function ($users) use ($progress, &$sent) {
                foreach ($users as $user) {
                    if ($this->remind($user, $progress)) {
                        $sent++;
                    }
                }
            });

        $this->info("Đã gửi {$sent} email nhắc học.");

        return self::SUCCESS;
    }

    private function remind(User $user, ProgressService $progress): bool
    {
        $time = UserSettings::get($user, 'reminder_time');
        if (! is_string($time) || ! preg_match('/^\d{2}:\d{2}$/', $time)) {
            return false;
        }

        $tz = $user->timezone ?: config('learning.default_timezone');
        $localNow = Carbon::now($tz);
        if ($localNow->format('H:i') < $time) {
            return false;
        }

        $date = $localNow->toDateString();
        $studied = (int) DB::table('daily_activity')->where('user_id', $user->id)->where('activity_date', $date)->value('reviews_count') > 0;
        if ($studied) {
            return false;
        }

        // Ghi log trước khi gửi: UNIQUE (user_id, type, for_date) chặn gửi trùng kể cả khi hai lần chạy chồng nhau.
        $inserted = DB::table('notification_logs')->insertOrIgnore([
            'user_id' => $user->id, 'type' => 'daily_reminder', 'for_date' => $date,
            'status' => 'sent', 'sent_at' => now(),
        ]);
        if ($inserted === 0) {
            return false;
        }

        try {
            // Đưa vào hàng đợi; worker (scheduler, mỗi phút) gửi thật. Lỗi gửi ghi qua DailyReminderMail::failed().
            Mail::to($user->email)->queue(new DailyReminderMail($user, $progress->dueCount($user), $date));

            return true;
        } catch (Throwable $e) {
            DB::table('notification_logs')
                ->where(['user_id' => $user->id, 'type' => 'daily_reminder', 'for_date' => $date])
                ->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 500)]);
            report($e);

            return false;
        }
    }
}
