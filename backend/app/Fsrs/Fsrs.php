<?php

namespace App\Fsrs;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * FSRS-6, port từ ts-fsrs 5.2.3 (BasicScheduler, có bước học ngắn hạn, không fuzz).
 * Tham số mặc định của ts-fsrs. Kết quả được test so khớp với ts-fsrs trong
 * tests/Unit/FsrsTest.php (dữ liệu sinh bởi tools/fsrs-fixtures).
 */
final class Fsrs
{
    public const DEFAULT_W = [
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
        1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ];

    public const S_MIN = 0.001;

    public const S_MAX = 36500.0;

    /** @var list<float> */
    private array $w;

    private float $decay;

    private float $factor;

    private float $intervalModifier;

    /**
     * @param  list<int>  $learningSteps  phút
     * @param  list<int>  $relearningSteps  phút
     * @param  list<float>|null  $w
     */
    public function __construct(
        private readonly float $requestRetention = 0.9,
        private readonly int $maximumInterval = 36500,
        private readonly array $learningSteps = [1, 10],
        private readonly array $relearningSteps = [10],
        ?array $w = null,
    ) {
        if ($requestRetention <= 0 || $requestRetention > 1) {
            throw new InvalidArgumentException('Mức ghi nhớ mong muốn phải trong khoảng (0, 1].');
        }

        $this->w = $w ?? self::DEFAULT_W;
        $this->decay = -$this->w[20];
        $this->factor = round(exp((1 / $this->decay) * log(0.9)) - 1, 8);
        $this->intervalModifier = round((($requestRetention ** (1 / $this->decay)) - 1) / $this->factor, 8);
    }

    /** Trạng thái thẻ sau khi trả lời bằng $rating lúc $now. */
    public function next(Card $card, DateTimeImmutable $now, int $rating): Card
    {
        return $this->preview($card, $now)[$rating]
            ?? throw new InvalidArgumentException("Rating không hợp lệ: {$rating}");
    }

    /**
     * Kết quả cho cả 4 mức đánh giá.
     *
     * @return array<int, Card> [rating => Card]
     */
    public function preview(Card $card, DateTimeImmutable $now): array
    {
        $now = $now->setTimezone(new DateTimeZone('UTC'));

        // init() của AbstractScheduler
        $elapsed = 0;
        if ($card->state !== State::NEW && $card->lastReview !== null) {
            $elapsed = self::dateDiffInDays($card->lastReview, $now);
        }
        $current = $card->with([
            'lastReview' => $now,
            'elapsedDays' => $elapsed,
            'reps' => $card->reps + 1,
        ]);

        $result = [];
        switch ($card->state) {
            case State::NEW:
                foreach (Rating::ALL as $g) {
                    $next = $current->with([
                        'difficulty' => self::clamp($this->initDifficulty($g), 1, 10),
                        'stability' => $this->initStability($g),
                    ]);
                    $result[$g] = $this->applyLearningSteps($current, $next, $g, State::LEARNING, $now, $elapsed);
                }
                break;

            case State::LEARNING:
            case State::RELEARNING:
                foreach (Rating::ALL as $g) {
                    $next = $current->with([
                        'difficulty' => $this->nextDifficulty($card->difficulty, $g),
                        'stability' => $this->nextShortTermStability($card->stability, $g),
                    ]);
                    $result[$g] = $this->applyLearningSteps($current, $next, $g, $card->state, $now, $elapsed);
                }
                break;

            case State::REVIEW:
                $result = $this->reviewState($card, $current, $now, $elapsed);
                break;

            default:
                throw new InvalidArgumentException("Trạng thái không hợp lệ: {$card->state}");
        }

        return $result;
    }

    /** Khả năng nhớ lại sau $elapsedDays ngày với độ ổn định $stability. */
    public function forgettingCurve(float $elapsedDays, float $stability): float
    {
        return round((1 + $this->factor * $elapsedDays / $stability) ** $this->decay, 8);
    }

    // ---------- Lập lịch ----------

    /** @return array<int, Card> */
    private function reviewState(Card $last, Card $current, DateTimeImmutable $now, int $interval): array
    {
        $d = $last->difficulty;
        $s = $last->stability;
        $r = $this->forgettingCurve($interval, $s);

        $sMin = round($s / exp($this->w[17] * $this->w[18]), 8);
        $again = $current->with([
            'difficulty' => $this->nextDifficulty($d, Rating::AGAIN),
            'stability' => self::clamp($sMin, self::S_MIN, $this->nextForgetStability($d, $s, $r)),
        ]);
        $hard = $current->with([
            'difficulty' => $this->nextDifficulty($d, Rating::HARD),
            'stability' => $this->nextRecallStability($d, $s, $r, Rating::HARD),
        ]);
        $good = $current->with([
            'difficulty' => $this->nextDifficulty($d, Rating::GOOD),
            'stability' => $this->nextRecallStability($d, $s, $r, Rating::GOOD),
        ]);
        $easy = $current->with([
            'difficulty' => $this->nextDifficulty($d, Rating::EASY),
            'stability' => $this->nextRecallStability($d, $s, $r, Rating::EASY),
        ]);

        $hardIvl = $this->nextInterval($hard->stability);
        $goodIvl = $this->nextInterval($good->stability);
        $hardIvl = min($hardIvl, $goodIvl);
        $goodIvl = max($goodIvl, $hardIvl + 1);
        $easyIvl = max($this->nextInterval($easy->stability), $goodIvl + 1);

        $again = $this->applyLearningSteps($current, $again, Rating::AGAIN, State::RELEARNING, $now, $interval);

        return [
            Rating::AGAIN => $again->with(['lapses' => $again->lapses + 1]),
            Rating::HARD => $hard->with(['scheduledDays' => $hardIvl, 'due' => self::addDays($now, $hardIvl), 'state' => State::REVIEW, 'learningSteps' => 0]),
            Rating::GOOD => $good->with(['scheduledDays' => $goodIvl, 'due' => self::addDays($now, $goodIvl), 'state' => State::REVIEW, 'learningSteps' => 0]),
            Rating::EASY => $easy->with(['scheduledDays' => $easyIvl, 'due' => self::addDays($now, $easyIvl), 'state' => State::REVIEW, 'learningSteps' => 0]),
        ];
    }

    private function applyLearningSteps(Card $current, Card $next, int $grade, int $toState, DateTimeImmutable $now, int $elapsed): Card
    {
        $curStep = ($current->state === State::LEARNING && $grade !== Rating::AGAIN && $grade !== Rating::HARD)
            ? $current->learningSteps + 1
            : $current->learningSteps;
        $info = $this->learningStepsStrategy($current->state, $curStep)[$grade] ?? null;
        $minutes = max(0, $info['minutes'] ?? 0);
        $nextStep = max(0, $info['next_step'] ?? 0);

        if ($minutes > 0 && $minutes < 1440) {
            return $next->with([
                'learningSteps' => $nextStep,
                'scheduledDays' => 0,
                'state' => $toState,
                'due' => self::addMinutes($now, (int) round($minutes)),
            ]);
        }

        if ($minutes >= 1440) {
            return $next->with([
                'state' => State::REVIEW,
                'learningSteps' => $nextStep,
                'due' => self::addMinutes($now, (int) round($minutes)),
                'scheduledDays' => intdiv($minutes, 1440),
            ]);
        }

        $ivl = $this->nextInterval($next->stability);

        return $next->with([
            'state' => State::REVIEW,
            'learningSteps' => 0,
            'scheduledDays' => $ivl,
            'due' => self::addDays($now, $ivl),
        ]);
    }

    /**
     * BasicLearningStepsStrategy của ts-fsrs.
     *
     * @return array<int, array{minutes: int, next_step: int}>
     */
    private function learningStepsStrategy(int $state, int $curStep): array
    {
        $steps = ($state === State::RELEARNING || $state === State::REVIEW) ? $this->relearningSteps : $this->learningSteps;
        $len = count($steps);
        if ($len === 0 || $curStep >= $len) {
            return [];
        }

        $stepAt = fn (int $i) => ($i >= 0 && $i < $len) ? $steps[$i] : null;

        if ($state === State::REVIEW) {
            return [Rating::AGAIN => ['minutes' => (int) $stepAt(max(0, $curStep)), 'next_step' => 0]];
        }

        $hard = $len === 1
            ? (int) round($steps[0] * 1.5)
            : (int) round(($steps[0] + $steps[1]) / 2);

        $result = [
            Rating::AGAIN => ['minutes' => $steps[0], 'next_step' => 0],
            Rating::HARD => ['minutes' => $hard, 'next_step' => $curStep],
        ];

        $nextMin = $stepAt($curStep + 1);
        if ($nextMin) {
            $result[Rating::GOOD] = ['minutes' => (int) round($nextMin), 'next_step' => $curStep + 1];
        }

        return $result;
    }

    // ---------- Công thức ----------

    private function initStability(int $g): float
    {
        return max($this->w[$g - 1], 0.1);
    }

    private function initDifficulty(int $g): float
    {
        return round($this->w[4] - exp(($g - 1) * $this->w[5]) + 1, 8);
    }

    private function nextInterval(float $s): int
    {
        $ivl = min(max(1, (int) round($s * $this->intervalModifier)), $this->maximumInterval);

        return (int) round($ivl); // không fuzz
    }

    private function nextDifficulty(float $d, int $g): float
    {
        $deltaD = -$this->w[6] * ($g - 3);
        $nextD = $d + round($deltaD * (10 - $d) / 9, 8);

        return self::clamp($this->meanReversion($this->initDifficulty(Rating::EASY), $nextD), 1, 10);
    }

    private function meanReversion(float $init, float $current): float
    {
        return round($this->w[7] * $init + (1 - $this->w[7]) * $current, 8);
    }

    private function nextRecallStability(float $d, float $s, float $r, int $g): float
    {
        $hardPenalty = $g === Rating::HARD ? $this->w[15] : 1;
        $easyBonus = $g === Rating::EASY ? $this->w[16] : 1;

        return round(self::clamp(
            $s * (1 + exp($this->w[8]) * (11 - $d) * ($s ** -$this->w[9]) * (exp((1 - $r) * $this->w[10]) - 1) * $hardPenalty * $easyBonus),
            self::S_MIN,
            self::S_MAX,
        ), 8);
    }

    private function nextForgetStability(float $d, float $s, float $r): float
    {
        return round(self::clamp(
            $this->w[11] * ($d ** -$this->w[12]) * ((($s + 1) ** $this->w[13]) - 1) * exp((1 - $r) * $this->w[14]),
            self::S_MIN,
            self::S_MAX,
        ), 8);
    }

    private function nextShortTermStability(float $s, int $g): float
    {
        $sinc = ($s ** -$this->w[19]) * exp($this->w[17] * ($g - 3 + $this->w[18]));
        $masked = $g >= 3 ? max($sinc, 1) : $sinc;

        return round(self::clamp($s * $masked, self::S_MIN, self::S_MAX), 8);
    }

    // ---------- Tiện ích ----------

    private static function clamp(float $v, float $min, float $max): float
    {
        return min(max($v, $min), $max);
    }

    /** Số ngày lịch (theo UTC) giữa hai thời điểm, như dateDiffInDays của ts-fsrs. */
    private static function dateDiffInDays(DateTimeImmutable $last, DateTimeImmutable $cur): int
    {
        $utc = new DateTimeZone('UTC');
        $a = new DateTimeImmutable($last->setTimezone($utc)->format('Y-m-d'), $utc);
        $b = new DateTimeImmutable($cur->setTimezone($utc)->format('Y-m-d'), $utc);

        return (int) floor(($b->getTimestamp() - $a->getTimestamp()) / 86400);
    }

    private static function addMinutes(DateTimeImmutable $t, int $minutes): DateTimeImmutable
    {
        return $t->add(new DateInterval('PT'.$minutes.'M'));
    }

    private static function addDays(DateTimeImmutable $t, int $days): DateTimeImmutable
    {
        return $t->add(new DateInterval('PT'.($days * 24).'H'));
    }
}
