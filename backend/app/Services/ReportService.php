<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserWord;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Báo cáo tuần, heatmap, biểu đồ tiến bộ (contract mục 8.2, 8.3). Ngày theo múi giờ người dùng. */
class ReportService
{
    public function __construct(private readonly ProgressService $progress) {}

    /** Thứ Hai của tuần trọn vẹn gần nhất (tuần trước). */
    public function lastFullWeekStart(User $user): Carbon
    {
        return Carbon::parse($this->progress->today($user))->startOfWeek(Carbon::MONDAY)->subWeek();
    }

    /** @return array<string, mixed> */
    public function weekly(User $user, Carbon $weekStart): array
    {
        $start = $weekStart->copy()->startOfDay();
        $end = $start->copy()->addDays(6);
        $current = $this->weekStats($user, $start, $end);
        $previous = $this->weekStats($user, $start->copy()->subWeek(), $end->copy()->subWeek());

        return [
            'week_start' => $start->toDateString(),
            'week_end' => $end->toDateString(),
            'days_active' => $current['days_active'],
            'reviews_count' => $current['reviews_count'],
            'words_saved' => $current['words_saved'],
            'newly_mastered' => $current['newly_mastered'],
            'mastered_total' => UserWord::ownedBy($user)
                ->whereNotNull('first_mastered_at')
                ->where('first_mastered_at', '<', $this->utcStartOf($user, $end->copy()->addDay()))
                ->count(),
            'accuracy' => $current['accuracy'],
            'xp_earned' => $current['xp_earned'],
            'previous' => [
                'days_active' => $previous['days_active'],
                'reviews_count' => $previous['reviews_count'],
                'words_saved' => $previous['words_saved'],
                'newly_mastered' => $previous['newly_mastered'],
                'accuracy' => $previous['accuracy'],
            ],
        ];
    }

    /** @return array{days_active: int, reviews_count: int, words_saved: int, xp_earned: int, newly_mastered: int, accuracy: ?float} */
    private function weekStats(User $user, Carbon $start, Carbon $end): array
    {
        $daily = DB::table('daily_activity')
            ->where('user_id', $user->id)
            ->whereBetween('activity_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('COUNT(*) FILTER (WHERE reviews_count > 0) AS days_active')
            ->selectRaw('COALESCE(SUM(reviews_count), 0) AS reviews')
            ->selectRaw('COALESCE(SUM(words_saved), 0) AS saved')
            ->selectRaw('COALESCE(SUM(xp_earned), 0) AS xp')
            ->first();

        $logs = DB::table('review_logs')
            ->where('user_id', $user->id)
            ->where('reviewed_at', '>=', $this->utcStartOf($user, $start))
            ->where('reviewed_at', '<', $this->utcStartOf($user, $end->copy()->addDay()))
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('COUNT(*) FILTER (WHERE rating >= 2) AS correct')
            ->selectRaw('COUNT(*) FILTER (WHERE became_mastered) AS mastered')
            ->first();

        return [
            'days_active' => (int) $daily->days_active,
            'reviews_count' => (int) $daily->reviews,
            'words_saved' => (int) $daily->saved,
            'xp_earned' => (int) $daily->xp,
            'newly_mastered' => (int) $logs->mastered,
            'accuracy' => $logs->total > 0 ? round($logs->correct / $logs->total, 4) : null,
        ];
    }

    /** @return list<array{date: string, reviews_count: int, words_saved: int, freeze_used: bool}> */
    public function heatmap(User $user, Carbon $from, Carbon $to): array
    {
        return DB::table('daily_activity')
            ->where('user_id', $user->id)
            ->whereBetween('activity_date', [$from->toDateString(), $to->toDateString()])
            ->where(fn ($q) => $q->where('reviews_count', '>', 0)->orWhere('words_saved', '>', 0)->orWhere('freeze_used', true))
            ->orderBy('activity_date')
            ->get(['activity_date', 'reviews_count', 'words_saved', 'freeze_used'])
            ->map(fn ($r) => [
                'date' => Carbon::parse($r->activity_date)->toDateString(),
                'reviews_count' => (int) $r->reviews_count,
                'words_saved' => (int) $r->words_saved,
                'freeze_used' => (bool) $r->freeze_used,
            ])->all();
    }

    /**
     * Một điểm cho mỗi ngày trong $days ngày gần nhất (kể cả hôm nay).
     *
     * @return list<array{date: string, saved_total: int, mastered_total: int, reviews_count: int}>
     */
    public function progress(User $user, int $days): array
    {
        $to = Carbon::parse($this->progress->today($user));
        $from = $to->copy()->subDays($days - 1);
        $fromUtc = $this->utcStartOf($user, $from);
        $tz = $this->tz($user);

        $savedBase = UserWord::ownedBy($user)->where('created_at', '<', $fromUtc)->count();
        $masteredBase = UserWord::ownedBy($user)->whereNotNull('first_mastered_at')->where('first_mastered_at', '<', $fromUtc)->count();

        $perDay = fn (string $column) => UserWord::ownedBy($user)
            ->whereNotNull($column)->where($column, '>=', $fromUtc)
            ->selectRaw("(({$column} AT TIME ZONE 'UTC') AT TIME ZONE ?)::date AS d, COUNT(*) AS n", [$tz])
            ->groupBy('d')->pluck('n', 'd')
            ->mapWithKeys(fn ($n, $d) => [Carbon::parse($d)->toDateString() => (int) $n]);

        $saved = $perDay('created_at');
        $mastered = $perDay('first_mastered_at');
        $reviews = DB::table('daily_activity')->where('user_id', $user->id)
            ->whereBetween('activity_date', [$from->toDateString(), $to->toDateString()])
            ->pluck('reviews_count', 'activity_date')
            ->mapWithKeys(fn ($n, $d) => [Carbon::parse($d)->toDateString() => (int) $n]);

        $points = [];
        $savedTotal = $savedBase;
        $masteredTotal = $masteredBase;
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $date = $day->toDateString();
            $savedTotal += $saved[$date] ?? 0;
            $masteredTotal += $mastered[$date] ?? 0;
            $points[] = [
                'date' => $date,
                'saved_total' => $savedTotal,
                'mastered_total' => $masteredTotal,
                'reviews_count' => $reviews[$date] ?? 0,
            ];
        }

        return $points;
    }

    /** 00:00 của ngày $date theo múi giờ người dùng, đổi sang UTC. */
    public function utcStartOf(User $user, Carbon $date): Carbon
    {
        return Carbon::parse($date->toDateString(), $this->tz($user))->startOfDay()->utc();
    }

    private function tz(User $user): string
    {
        return $user->timezone ?: config('learning.default_timezone');
    }
}
