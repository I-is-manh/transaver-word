<?php

namespace Tests\Unit;

use App\Fsrs\Card;
use App\Fsrs\Fsrs;
use App\Fsrs\Rating;
use App\Fsrs\State;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * So kết quả FSRS (PHP) với ts-fsrs 5.2.3 trên các chuỗi lần ôn cố định.
 * Dữ liệu chuẩn: tests/Fixtures/fsrs.json, sinh bằng tools/fsrs-fixtures/generate.mjs.
 */
class FsrsTest extends TestCase
{
    public static function cases(): array
    {
        $data = json_decode(file_get_contents(__DIR__.'/../Fixtures/fsrs.json'), true, flags: JSON_THROW_ON_ERROR);
        $out = [];
        foreach ($data['cases'] as $case) {
            $out["{$case['name']} r={$case['retention']}"] = [$case, $data['start']];
        }

        return $out;
    }

    #[DataProvider('cases')]
    public function test_matches_ts_fsrs(array $case, string $start): void
    {
        $fsrs = new Fsrs(requestRetention: $case['retention']);
        $card = Card::empty(new DateTimeImmutable($start));

        foreach ($case['steps'] as $i => $step) {
            $now = new DateTimeImmutable($step['now']);
            $label = "{$case['name']} bước {$i}";

            $preview = $fsrs->preview($card, $now);
            foreach ($step['intervals'] as $rating => $seconds) {
                $this->assertSame($seconds, $preview[(int) $rating]->due->getTimestamp() - $now->getTimestamp(), "{$label}: khoảng cách rating {$rating}");
            }

            $card = $fsrs->next($card, $now, $step['rating']);
            $expected = $step['card'];

            $this->assertSame($expected['state'], $card->state, "{$label}: state");
            $this->assertSame((new DateTimeImmutable($expected['due']))->getTimestamp(), $card->due->getTimestamp(), "{$label}: due");
            $this->assertEqualsWithDelta($expected['stability'], $card->stability, 1e-6, "{$label}: stability");
            $this->assertEqualsWithDelta($expected['difficulty'], $card->difficulty, 1e-6, "{$label}: difficulty");
            $this->assertSame($expected['elapsed_days'], $card->elapsedDays, "{$label}: elapsed_days");
            $this->assertSame($expected['scheduled_days'], $card->scheduledDays, "{$label}: scheduled_days");
            $this->assertSame($expected['reps'], $card->reps, "{$label}: reps");
            $this->assertSame($expected['lapses'], $card->lapses, "{$label}: lapses");
            $this->assertSame($expected['learning_steps'], $card->learningSteps, "{$label}: learning_steps");
        }
    }

    public function test_new_card_good_goes_to_learning_for_10_minutes(): void
    {
        $now = new DateTimeImmutable('2026-01-01T00:00:00Z');
        $card = (new Fsrs)->next(Card::empty($now), $now, Rating::GOOD);

        $this->assertSame(State::LEARNING, $card->state);
        $this->assertSame(600, $card->due->getTimestamp() - $now->getTimestamp());
    }

    public function test_higher_retention_gives_shorter_intervals(): void
    {
        $now = new DateTimeImmutable('2026-01-01T00:00:00Z');
        $card = Card::empty($now);
        $low = new Fsrs(0.85);
        $high = new Fsrs(0.95);

        $a = $low->next($low->next($card, $now, Rating::EASY), $now->modify('+8 days'), Rating::GOOD);
        $b = $high->next($high->next($card, $now, Rating::EASY), $now->modify('+8 days'), Rating::GOOD);

        $this->assertGreaterThan($b->scheduledDays, $a->scheduledDays);
    }
}
