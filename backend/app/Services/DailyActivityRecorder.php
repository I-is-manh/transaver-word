<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Cộng dồn số liệu vào daily_activity theo ngày trong múi giờ của người dùng. */
class DailyActivityRecorder
{
    /** @var list<string> */
    private const COUNTERS = ['reviews_count', 'new_words_learned', 'words_saved', 'study_seconds', 'xp_earned'];

    /** Ngày học hôm nay của người dùng (YYYY-MM-DD). */
    public function today(User $user): string
    {
        return Carbon::now($user->timezone ?: config('learning.default_timezone'))->toDateString();
    }

    public function increment(User $user, string $column, int $by = 1): void
    {
        if (! in_array($column, self::COUNTERS, true)) {
            throw new \InvalidArgumentException("Cột không hợp lệ: {$column}");
        }

        $now = now();

        // Một câu lệnh, an toàn khi nhiều request cùng lúc.
        DB::statement(
            "INSERT INTO daily_activity (user_id, activity_date, {$column}, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, activity_date)
             DO UPDATE SET {$column} = daily_activity.{$column} + EXCLUDED.{$column}, updated_at = EXCLUDED.updated_at",
            [$user->id, $this->today($user), $by, $now, $now],
        );
    }
}
