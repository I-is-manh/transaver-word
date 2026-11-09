<?php

namespace App\Fsrs;

use DateTimeImmutable;

/** Trạng thái FSRS của một thẻ (bất biến). Tên trường giống ts-fsrs. */
final class Card
{
    public function __construct(
        public readonly ?DateTimeImmutable $due,
        public readonly float $stability = 0.0,
        public readonly float $difficulty = 0.0,
        public readonly int $elapsedDays = 0,
        public readonly int $scheduledDays = 0,
        public readonly int $reps = 0,
        public readonly int $lapses = 0,
        public readonly int $learningSteps = 0,
        public readonly int $state = State::NEW,
        public readonly ?DateTimeImmutable $lastReview = null,
    ) {}

    public static function empty(?DateTimeImmutable $now = null): self
    {
        return new self($now);
    }

    /** @param array<string, mixed> $changes */
    public function with(array $changes): self
    {
        $values = get_object_vars($this);

        foreach ($changes as $key => $value) {
            if (! array_key_exists($key, $values)) {
                throw new \InvalidArgumentException("Không có trường {$key}");
            }
            $values[$key] = $value;
        }

        return new self(...$values);
    }
}
