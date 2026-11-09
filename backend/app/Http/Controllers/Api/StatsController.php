<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserWord;
use App\Services\ProgressService;
use App\Support\UserSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Thống kê cơ bản và trạng thái hôm nay (contract mục 6.2). */
class StatsController extends Controller
{
    public function __construct(private readonly ProgressService $progress) {}

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $counts = UserWord::ownedBy($user)
            ->selectRaw('COUNT(*) AS saved')
            ->selectRaw("COUNT(*) FILTER (WHERE status = 'learning') AS learning")
            ->selectRaw("COUNT(*) FILTER (WHERE status = 'known') AS known")
            ->selectRaw('COUNT(*) FILTER (WHERE fsrs_state = 2 AND stability >= ?) AS mastered', [(float) config('learning.mastered_stability')])
            ->selectRaw("COUNT(*) FILTER (WHERE status = 'learning' AND lapses >= ?) AS hard", [(int) config('learning.hard_lapses')])
            ->first();

        $dueToday = $this->progress->dueCount($user);
        $overload = $dueToday > (int) UserSettings::get($user, 'daily_review_limit');
        $newAvailable = $overload ? 0 : min($this->progress->newAvailableCount($user), $this->progress->newAllowanceToday($user));

        return response()->json([
            'saved_count' => (int) $counts->saved,
            'learning_count' => (int) $counts->learning,
            'known_count' => (int) $counts->known,
            'mastered_count' => (int) $counts->mastered,
            'hard_count' => (int) $counts->hard,
            'due_today' => $dueToday,
            'new_available_today' => $newAvailable,
            'today' => $this->progress->dailyProgress($user),
            'streak' => $this->progress->streak($user),
            'xp' => $this->progress->xp($user),
        ]);
    }

    /** Extension dùng để quyết định có hiện thông báo nhắc học không. */
    public function today(Request $request): JsonResponse
    {
        $user = $request->user();
        $date = $this->progress->today($user);
        $reviews = (int) DB::table('daily_activity')->where('user_id', $user->id)->where('activity_date', $date)->value('reviews_count');
        $settings = UserSettings::values($user);

        return response()->json([
            'date' => $date,
            'studied' => $reviews > 0,
            'due_count' => $this->progress->dueCount($user),
            'reminder_time' => $settings['reminder_time'],
            'reminder_channels' => array_values($settings['reminder_channels']),
        ]);
    }
}
