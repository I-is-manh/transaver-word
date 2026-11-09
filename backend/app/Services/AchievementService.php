<?php

namespace App\Services;

use App\Models\Achievement;
use App\Models\ReviewSession;
use App\Models\User;
use App\Models\UserWord;
use App\Support\ApiDate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Kiểm tra và trao huy hiệu (contract mục 8.1). Gọi ở 3 điểm: sau khi lưu từ, sau khi trả lời thẻ,
 * khi kết thúc buổi ôn. Mỗi lần chỉ xét các huy hiệu chưa đạt; đạt thì cộng xp_reward.
 */
class AchievementService
{
    public const EVENT_WORD_SAVED = 'word_saved';

    public const EVENT_ANSWERED = 'answered';

    public const EVENT_SESSION_FINISHED = 'session_finished';

    public function __construct(private readonly ProgressService $progress) {}

    /**
     * @param  array<string, mixed>  $context  session_id khi kết thúc buổi ôn
     * @return list<array<string, mixed>> huy hiệu vừa đạt (object Achievement)
     */
    public function check(User $user, string $event, array $context = []): array
    {
        $earnedIds = DB::table('user_achievements')->where('user_id', $user->id)->pluck('achievement_id')->all();
        $pending = Achievement::whereNotIn('id', $earnedIds)->orderBy('id')->get();

        $new = [];
        foreach ($pending as $achievement) {
            if (! $this->met($user, $achievement->criteria, $event, $context)) {
                continue;
            }

            $now = now();
            $inserted = DB::table('user_achievements')->insertOrIgnore([
                'user_id' => $user->id, 'achievement_id' => $achievement->id, 'earned_at' => $now,
            ]);
            if ($inserted === 0) {
                continue; // request khác vừa trao
            }

            $this->progress->addXp($user, (int) $achievement->xp_reward);
            $new[] = self::present($achievement, $now);
        }

        return $new;
    }

    /** @return list<array<string, mixed>> mọi huy hiệu, trừ huy hiệu ẩn chưa đạt */
    public function list(User $user): array
    {
        $earned = DB::table('user_achievements')->where('user_id', $user->id)->pluck('earned_at', 'achievement_id');

        return Achievement::orderBy('id')->get()
            ->filter(fn (Achievement $a) => ! $a->is_hidden || isset($earned[$a->id]))
            ->map(fn (Achievement $a) => self::present($a, isset($earned[$a->id]) ? Carbon::parse($earned[$a->id]) : null))
            ->values()->all();
    }

    /** @return array<string, mixed> */
    public static function present(Achievement $a, ?\DateTimeInterface $earnedAt): array
    {
        return [
            'code' => $a->code,
            'name' => $a->name,
            'description' => $a->description,
            'icon' => $a->icon,
            'xp_reward' => (int) $a->xp_reward,
            'earned_at' => ApiDate::format($earnedAt),
        ];
    }

    /** @param array<string, mixed> $c */
    private function met(User $user, array $c, string $event, array $context): bool
    {
        return match ($c['type'] ?? null) {
            'words_saved' => $event === self::EVENT_WORD_SAVED && UserWord::withTrashed()->ownedBy($user)->count() >= $c['gte'],
            'sessions_finished' => $event === self::EVENT_SESSION_FINISHED && ReviewSession::where('user_id', $user->id)->whereNotNull('ended_at')->where('cards_reviewed', '>', 0)->count() >= $c['gte'],
            'streak' => (int) $this->progress->progress($user)->current_streak >= $c['gte'],
            'mastered' => UserWord::ownedBy($user)->where('fsrs_state', 2)
                ->where('stability', '>=', (float) config('learning.mastered_stability'))->count() >= $c['gte'],
            'distinct_sites' => $event === self::EVENT_WORD_SAVED && $this->distinctSites($user) >= $c['gte'],
            'perfect_session' => $event === self::EVENT_SESSION_FINISHED && $this->perfectSession($user, $context['session_id'] ?? null, (int) $c['min_cards']),
            'comeback' => $event === self::EVENT_ANSWERED && $this->isComeback($user, (int) $c['gap_days']),
            default => false,
        };
    }

    /** Số host khác nhau trong link các câu đã lưu. */
    private function distinctSites(User $user): int
    {
        return (int) DB::table('word_contexts')
            ->where('user_id', $user->id)
            ->whereNotNull('page_url')
            ->selectRaw("COUNT(DISTINCT LOWER(SUBSTRING(page_url FROM '^https?://(?:www\\.)?([^/:?#]+)'))) AS n")
            ->value('n');
    }

    private function perfectSession(User $user, ?int $sessionId, int $minCards): bool
    {
        if ($sessionId === null) {
            return false;
        }
        $session = ReviewSession::where('user_id', $user->id)->find($sessionId);

        return $session !== null
            && $session->cards_reviewed >= $minCards
            && ! $session->logs()->where('rating', 1)->exists();
    }

    /** Hôm nay là ngày ôn đầu tiên sau ít nhất $gapDays ngày không ôn (đã từng ôn trước đó). */
    private function isComeback(User $user, int $gapDays): bool
    {
        $today = $this->progress->today($user);
        $previous = DB::table('daily_activity')
            ->where('user_id', $user->id)
            ->where('activity_date', '<', $today)
            ->where('reviews_count', '>', 0)
            ->max('activity_date');

        return $previous !== null && Carbon::parse($previous)->diffInDays(Carbon::parse($today)) >= $gapDays;
    }
}
