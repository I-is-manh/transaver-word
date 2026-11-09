<?php

namespace App\Services\Review;

use App\Fsrs\Card;
use App\Fsrs\Fsrs;
use App\Models\User;
use App\Models\UserWord;
use App\Support\UserSettings;
use DateTimeImmutable;

/** Tạo bộ lập lịch FSRS theo cài đặt của người dùng, và chuyển đổi giữa UserWord và Card. */
class FsrsFactory
{
    public function for(User $user): Fsrs
    {
        $retention = (float) UserSettings::get($user, 'desired_retention');

        return new Fsrs(
            requestRetention: min(0.97, max(0.8, $retention ?: 0.9)),
            maximumInterval: (int) config('learning.fsrs.maximum_interval'),
            learningSteps: config('learning.fsrs.learning_steps'),
            relearningSteps: config('learning.fsrs.relearning_steps'),
        );
    }

    public static function cardFromWord(UserWord $word): Card
    {
        return new Card(
            due: $word->due_at ? DateTimeImmutable::createFromInterface($word->due_at) : null,
            stability: (float) $word->stability,
            difficulty: (float) $word->difficulty,
            elapsedDays: (int) $word->elapsed_days,
            scheduledDays: (int) $word->scheduled_days,
            reps: (int) $word->reps,
            lapses: (int) $word->lapses,
            learningSteps: (int) $word->learning_steps,
            state: (int) $word->fsrs_state,
            lastReview: $word->last_review_at ? DateTimeImmutable::createFromInterface($word->last_review_at) : null,
        );
    }

    public static function applyToWord(Card $card, UserWord $word): void
    {
        $word->forceFill([
            'fsrs_state' => $card->state,
            'due_at' => $card->due,
            'stability' => $card->stability,
            'difficulty' => $card->difficulty,
            'elapsed_days' => $card->elapsedDays,
            'scheduled_days' => $card->scheduledDays,
            'reps' => $card->reps,
            'lapses' => $card->lapses,
            'learning_steps' => $card->learningSteps,
            'last_review_at' => $card->lastReview,
        ]);
    }
}
