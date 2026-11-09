<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserProgress;
use App\Models\UserWord;
use App\Support\UserSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * DailyProgress, Streak, Xp (contract mục 5.6). Mọi "ngày" tính theo múi giờ của người dùng.
 *
 * Luật streak: một ngày "đã học" khi có ≥ 1 lượt ôn. Mỗi ngày bỏ lỡ tự dùng 1 thẻ đóng băng
 * (đánh dấu daily_activity.freeze_used); hết thẻ thì streak về 0. Cứ đủ freeze_every_days ngày
 * học liên tiếp được thêm 1 thẻ, giữ tối đa max_freezes. Ngày dùng thẻ giữ streak nhưng không cộng thêm.
 */
class ProgressService
{
    public function __construct(private readonly DailyActivityRecorder $activity) {}

    public function today(User $user): string
    {
        return $this->activity->today($user);
    }

    /** Cuối ngày hôm nay theo múi giờ người dùng, đổi sang UTC (để so với due_at). */
    public function endOfToday(User $user): Carbon
    {
        return Carbon::now($this->tz($user))->endOfDay()->utc();
    }

    // ---------- DailyProgress ----------

    /** @return array<string, mixed> */
    public function dailyProgress(User $user): array
    {
        $date = $this->today($user);
        $row = DB::table('daily_activity')->where('user_id', $user->id)->where('activity_date', $date)->first();
        $settings = UserSettings::values($user);

        $reviews = (int) ($row->reviews_count ?? 0);
        $newLearned = (int) ($row->new_words_learned ?? 0);
        $goalNew = (int) $settings['daily_new_words'];
        $dueRemaining = $this->dueCount($user);

        $reviewsDone = $dueRemaining === 0 || $reviews >= (int) $settings['daily_review_limit'];
        $newDone = $newLearned >= $goalNew || $this->newAvailableCount($user) === 0;

        return [
            'date' => $date,
            'reviews_count' => $reviews,
            'new_words_learned' => $newLearned,
            'words_saved' => (int) ($row->words_saved ?? 0),
            'xp_earned' => (int) ($row->xp_earned ?? 0),
            'goal_new_words' => $goalNew,
            'due_remaining' => $dueRemaining,
            'goal_met' => $reviews > 0 && $reviewsDone && $newDone,
        ];
    }

    /** Số từ đang học, đến hạn trước cuối ngày hôm nay (không tính từ mới chưa học). */
    public function dueCount(User $user, ?int $deckId = null): int
    {
        return $this->dueQuery($user, $deckId)->count();
    }

    public function dueQuery(User $user, ?int $deckId = null)
    {
        return UserWord::ownedBy($user)
            ->where('status', UserWord::STATUS_LEARNING)
            ->whereNotNull('due_at')
            ->where('fsrs_state', '!=', 0)
            ->where('due_at', '<=', $this->endOfToday($user))
            ->when($deckId, fn ($q) => $q->whereIn('id', DB::table('deck_words')->where('deck_id', $deckId)->select('user_word_id')));
    }

    public function newAvailableCount(User $user): int
    {
        return UserWord::ownedBy($user)->where('status', UserWord::STATUS_LEARNING)->where('fsrs_state', 0)->count();
    }

    /** Số từ mới còn được học hôm nay theo mục tiêu. */
    public function newAllowanceToday(User $user): int
    {
        $learned = (int) DB::table('daily_activity')
            ->where('user_id', $user->id)->where('activity_date', $this->today($user))
            ->value('new_words_learned');

        return max(0, (int) UserSettings::get($user, 'daily_new_words') - $learned);
    }

    // ---------- Streak ----------

    /**
     * Tính lại streak tới hôm nay (dùng thẻ đóng băng cho ngày bỏ lỡ, hoặc về 0) rồi trả object Streak.
     *
     * @return array<string, mixed>
     */
    public function streak(User $user): array
    {
        $progress = $this->refreshStreak($user);
        $today = $this->today($user);

        return [
            'current' => (int) $progress->current_streak,
            'longest' => (int) $progress->longest_streak,
            'freezes_available' => (int) $progress->freezes_available,
            'last_active_date' => $progress->last_active_date?->toDateString(),
            'today_done' => $progress->last_active_date?->toDateString() === $today,
        ];
    }

    /** Gọi khi có lượt ôn đầu tiên trong ngày. */
    public function recordStudyDay(User $user): UserProgress
    {
        $progress = $this->refreshStreak($user);
        $today = $this->today($user);

        if ($progress->last_active_date?->toDateString() === $today) {
            return $progress;
        }

        $progress->current_streak = (int) $progress->current_streak + 1;
        $progress->longest_streak = max((int) $progress->longest_streak, $progress->current_streak);
        $progress->last_active_date = $today;

        $every = (int) config('learning.freeze_every_days');
        if ($every > 0 && $progress->current_streak % $every === 0) {
            $progress->freezes_available = min((int) config('learning.max_freezes'), (int) $progress->freezes_available + 1);
        }

        $progress->save();

        return $progress;
    }

    /** Xử lý các ngày bỏ lỡ từ lần học cuối tới hôm qua. Gọi nhiều lần không sao. */
    private function refreshStreak(User $user): UserProgress
    {
        $progress = $this->progress($user, lock: true);
        $last = $progress->last_active_date;

        if ($last === null || (int) $progress->current_streak === 0) {
            return $progress;
        }

        $today = Carbon::parse($this->today($user));
        $day = $last->copy()->addDay();
        $covered = DB::table('daily_activity')
            ->where('user_id', $user->id)
            ->whereBetween('activity_date', [$day->toDateString(), $today->copy()->subDay()->toDateString()])
            ->where(fn ($q) => $q->where('freeze_used', true)->orWhere('reviews_count', '>', 0))
            ->pluck('activity_date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->all();

        $changed = false;
        for (; $day->lt($today); $day->addDay()) {
            $date = $day->toDateString();
            if (in_array($date, $covered, true)) {
                continue;
            }
            if ((int) $progress->freezes_available > 0) {
                $progress->freezes_available = (int) $progress->freezes_available - 1;
                DB::statement(
                    'INSERT INTO daily_activity (user_id, activity_date, freeze_used, created_at, updated_at)
                     VALUES (?, ?, true, ?, ?)
                     ON CONFLICT (user_id, activity_date) DO UPDATE SET freeze_used = true',
                    [$user->id, $date, now(), now()],
                );
                $changed = true;

                continue;
            }
            $progress->current_streak = 0;
            $changed = true;
            break;
        }

        if ($changed) {
            $progress->save();
        }

        return $progress;
    }

    // ---------- XP ----------

    /** @return array{total: int, level: int, level_progress: float, xp_to_next_level: int} */
    public function xp(User $user): array
    {
        return self::xpFor((int) $this->progress($user)->total_xp);
    }

    /** @return array{total: int, level: int, level_progress: float, xp_to_next_level: int} */
    public static function xpFor(int $total): array
    {
        $base = (int) config('learning.xp.level_base');
        $required = fn (int $n) => $base * $n * ($n - 1);

        $level = 1;
        while ($required($level + 1) <= $total) {
            $level++;
        }
        $from = $required($level);
        $to = $required($level + 1);

        return [
            'total' => $total,
            'level' => $level,
            'level_progress' => round(($total - $from) / ($to - $from), 4),
            'xp_to_next_level' => $to - $total,
        ];
    }

    public function addXp(User $user, int $xp): void
    {
        if ($xp <= 0) {
            return;
        }
        UserProgress::where('user_id', $user->id)->increment('total_xp', $xp);
        $this->activity->increment($user, 'xp_earned', $xp);
    }

    // ---------- tiện ích ----------

    public function progress(User $user, bool $lock = false): UserProgress
    {
        $query = UserProgress::where('user_id', $user->id);
        if ($lock && DB::transactionLevel() > 0) {
            $query->lockForUpdate();
        }

        return $query->first() ?? UserProgress::create(['user_id' => $user->id]);
    }

    private function tz(User $user): string
    {
        return $user->timezone ?: config('learning.default_timezone');
    }
}
