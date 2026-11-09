<?php

namespace App\Services\Review;

use App\Http\Resources\WordResource;
use App\Models\ReviewLog;
use App\Models\ReviewSession;
use App\Models\User;
use App\Models\UserWord;
use App\Services\AchievementService;
use App\Services\DailyActivityRecorder;
use App\Services\ProgressService;
use App\Support\ApiDate;
use App\Support\UserSettings;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Buổi ôn: tạo, trả lời thẻ, kết thúc (contract mục 5.3–5.5). */
class ReviewService
{
    public function __construct(
        private readonly CardBuilder $cards,
        private readonly FsrsFactory $fsrsFactory,
        private readonly ProgressService $progress,
        private readonly DailyActivityRecorder $activity,
        private readonly AchievementService $achievements,
    ) {}

    // ---------- 5.3 bắt đầu buổi ôn ----------

    /** @return array{session: ReviewSession, cards: list<array>, overload: bool} */
    public function start(User $user, string $mode, ?int $deckId): array
    {
        [$words, $overload] = match ($mode) {
            ReviewSession::MODE_HARD => [$this->hardWords($user), false],
            default => $this->dailyWords($user, $mode === ReviewSession::MODE_DECK ? $deckId : null),
        };

        $session = ReviewSession::create([
            'user_id' => $user->id,
            'mode' => $mode,
            'deck_id' => $mode === ReviewSession::MODE_DECK ? $deckId : null,
            'started_at' => now(),
        ]);

        return [
            'session' => $session,
            'cards' => $this->cards->build($user, $words),
            'overload' => $overload,
        ];
    }

    /** @return array{0: Collection<int, UserWord>, 1: bool} */
    private function dailyWords(User $user, ?int $deckId): array
    {
        $limit = (int) UserSettings::get($user, 'daily_review_limit');
        $dueQuery = $this->progress->dueQuery($user, $deckId);
        $dueTotal = (clone $dueQuery)->count();
        $due = $dueQuery->with(['dictionaryEntry', 'decks'])->withCount('contexts')
            ->orderBy('due_at')->orderBy('id')->limit($limit)->get();

        // Chống dồn ứ: từ đến hạn nhiều hơn giới hạn thì không thêm từ mới.
        $overload = $dueTotal > $limit;
        $new = new Collection;
        if (! $overload) {
            $allowance = $this->progress->newAllowanceToday($user);
            if ($allowance > 0) {
                $new = UserWord::ownedBy($user)
                    ->where('status', UserWord::STATUS_LEARNING)->where('fsrs_state', 0)
                    ->when($deckId, fn ($q) => $q->whereIn('id', DB::table('deck_words')->where('deck_id', $deckId)->select('user_word_id')))
                    ->with(['dictionaryEntry', 'decks'])->withCount('contexts')
                    ->orderBy('created_at')->orderBy('id')->limit($allowance)->get();
            }
        }

        return [self::interleave($due, $new), $overload];
    }

    private function hardWords(User $user): Collection
    {
        return UserWord::ownedBy($user)
            ->where('status', UserWord::STATUS_LEARNING)
            ->where('lapses', '>=', (int) config('learning.hard_lapses'))
            ->with(['dictionaryEntry', 'decks'])->withCount('contexts')
            ->orderByDesc('lapses')->orderBy('id')
            ->limit((int) config('learning.hard_session_limit'))->get();
    }

    /** Rải đều từ mới vào giữa từ ôn (không dồn cuối). */
    public static function interleave(Collection $reviews, Collection $new): Collection
    {
        $r = $reviews->count();
        $n = $new->count();
        if ($n === 0 || $r === 0) {
            return $reviews->concat($new)->values();
        }

        $items = [];
        foreach ($reviews->values() as $i => $w) {
            $items[] = [($i + 1) / ($r + 1), 0, $w];
        }
        foreach ($new->values() as $j => $w) {
            $items[] = [($j + 1) / ($n + 1), 1, $w];
        }
        usort($items, fn ($a, $b) => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

        return new Collection(array_column($items, 2));
    }

    // ---------- 5.4 trả lời ----------

    /**
     * @param  array{client_uuid: string, session_id: int, user_word_id: int, exercise_type: string, rating: int,
     *               is_correct?: ?bool, answer?: ?string, word_context_id?: ?int}  $data
     * @return array<string, mixed>
     */
    public function answer(User $user, ReviewSession $session, UserWord $word, array $data): array
    {
        if ($existing = $this->existingLog($user, $data['client_uuid'])) {
            return $this->replay($user, $existing);
        }

        try {
            $result = DB::transaction(fn () => $this->applyAnswer($user, $session, $word->id, $data));
        } catch (UniqueConstraintViolationException) {
            // Hai request cùng client_uuid chạy song song: request kia đã ghi trước.
            return $this->replay($user, $this->existingLog($user, $data['client_uuid']));
        }

        // Huy hiệu kiểm tra sau khi transaction ghi xong.
        $result['new_achievements'] = $this->achievements->check($user, AchievementService::EVENT_ANSWERED, ['log_id' => $result['log_id']]);
        unset($result['log_id']);

        $result['today'] = $this->progress->dailyProgress($user);
        $result['streak'] = $this->progress->streak($user);

        return $result;
    }

    private function applyAnswer(User $user, ReviewSession $session, int $wordId, array $data): array
    {
        $word = UserWord::ownedBy($user)->lockForUpdate()->findOrFail($wordId);
        $now = Carbon::now();
        $rating = (int) $data['rating'];

        $stateBefore = (int) $word->fsrs_state;
        $wasMastered = $word->isMastered();
        $isFirstReviewToday = (int) DB::table('daily_activity')
            ->where('user_id', $user->id)->where('activity_date', $this->progress->today($user))
            ->value('reviews_count') === 0;

        $card = $this->fsrsFactory->for($user)->next(FsrsFactory::cardFromWord($word), new DateTimeImmutable('@'.$now->getTimestamp()), $rating);
        FsrsFactory::applyToWord($card, $word);

        $becameMastered = ! $wasMastered && $word->first_mastered_at === null && $word->isMastered();
        if ($becameMastered) {
            $word->first_mastered_at = $now;
        }
        $word->save();

        $xp = (int) (config('learning.xp.rating')[$rating] ?? 0)
            + ($becameMastered ? (int) config('learning.xp.mastered_bonus') : 0);
        $correct = $rating >= 2;

        $log = ReviewLog::create([
            'client_uuid' => $data['client_uuid'],
            'user_id' => $user->id,
            'user_word_id' => $word->id,
            'session_id' => $session->id,
            'word_context_id' => $data['word_context_id'] ?? null,
            'exercise_type' => $data['exercise_type'],
            'rating' => $rating,
            'is_correct' => $data['is_correct'] ?? null,
            'answer' => $data['answer'] ?? null,
            'state_before' => $stateBefore,
            'elapsed_days' => $card->elapsedDays,
            'scheduled_days' => $card->scheduledDays,
            'stability_after' => $card->stability,
            'difficulty_after' => $card->difficulty,
            'due_after' => $card->due,
            'xp_earned' => $xp,
            'became_mastered' => $becameMastered,
            'reviewed_at' => $now,
        ]);

        // Số liệu ngày, buổi ôn, streak, XP
        $this->activity->increment($user, 'reviews_count');
        if ($stateBefore === 0) {
            $this->activity->increment($user, 'new_words_learned');
        }
        $this->progress->addXp($user, $xp);

        ReviewSession::whereKey($session->id)->update([
            'cards_reviewed' => DB::raw('cards_reviewed + 1'),
            'new_cards' => DB::raw('new_cards + '.($stateBefore === 0 ? 1 : 0)),
            'correct_count' => DB::raw('correct_count + '.($correct ? 1 : 0)),
            'xp_earned' => DB::raw('xp_earned + '.$xp),
        ]);

        if ($isFirstReviewToday) {
            $this->progress->recordStudyDay($user);
        }
        $this->updateGoalMet($user);

        return [
            'log_id' => $log->id,
            'word' => new WordResource($word->load(['dictionaryEntry', 'decks'])->loadCount('contexts')),
            'next_due_at' => ApiDate::format($card->due),
            'xp_earned' => $xp,
            'became_mastered' => $becameMastered,
        ];
    }

    private function updateGoalMet(User $user): void
    {
        if ($this->progress->dailyProgress($user)['goal_met']) {
            DB::table('daily_activity')
                ->where('user_id', $user->id)->where('activity_date', $this->progress->today($user))
                ->update(['goal_met' => true]);
        }
    }

    private function existingLog(User $user, string $uuid): ?ReviewLog
    {
        $log = ReviewLog::where('client_uuid', $uuid)->first();
        if ($log && $log->user_id !== $user->id) {
            abort(409, __('review.uuid_conflict'));
        }

        return $log;
    }

    /** Gửi lại cùng client_uuid: trả kết quả của lần đầu, không tính lần hai. */
    private function replay(User $user, ReviewLog $log): array
    {
        $word = UserWord::withTrashed()->with(['dictionaryEntry', 'decks'])->withCount('contexts')->find($log->user_word_id);

        return [
            'word' => $word ? new WordResource($word) : null,
            'next_due_at' => ApiDate::format($log->due_after),
            'xp_earned' => $log->xp_earned,
            'became_mastered' => $log->became_mastered,
            'today' => $this->progress->dailyProgress($user),
            'streak' => $this->progress->streak($user),
            'new_achievements' => [],
        ];
    }

    // ---------- 5.5 kết thúc ----------

    /** @return array<string, mixed> */
    public function finish(User $user, ReviewSession $session): array
    {
        $newAchievements = [];
        if ($session->ended_at === null) {
            $now = now();
            $seconds = (int) min((int) config('learning.max_session_seconds'), max(0, $session->started_at->diffInSeconds($now, true)));
            $session->forceFill(['ended_at' => $now, 'duration_seconds' => $seconds])->save();
            $this->activity->increment($user, 'study_seconds', $seconds);
            $newAchievements = $this->achievements->check($user, AchievementService::EVENT_SESSION_FINISHED, ['session_id' => $session->id]);
        }
        $session->refresh();

        return [
            'summary' => [
                'cards_reviewed' => $session->cards_reviewed,
                'correct_count' => $session->correct_count,
                'new_cards' => $session->new_cards,
                'xp_earned' => $session->xp_earned,
                'duration_seconds' => $session->duration_seconds,
                'newly_mastered' => $session->logs()->where('became_mastered', true)->count(),
            ],
            'today' => $this->progress->dailyProgress($user),
            'streak' => $this->progress->streak($user),
            'xp' => $this->progress->xp($user),
            'new_achievements' => $newAchievements,
        ];
    }
}
