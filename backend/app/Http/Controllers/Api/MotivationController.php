<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserWord;
use App\Services\AchievementService;
use App\Services\ProgressService;
use App\Services\ReportService;
use App\Support\ApiDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/** Huy hiệu, báo cáo tuần, heatmap, biểu đồ tiến bộ, danh sách highlight (contract mục 8). */
class MotivationController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly ProgressService $progress,
    ) {}

    public function achievements(Request $request, AchievementService $achievements): JsonResponse
    {
        return response()->json(['data' => $achievements->list($request->user())]);
    }

    public function weekly(Request $request): JsonResponse
    {
        $data = $request->validate(['week_start' => ['nullable', 'date_format:Y-m-d']]);
        $user = $request->user();

        if (! empty($data['week_start'])) {
            $start = Carbon::createFromFormat('Y-m-d', $data['week_start'])->startOfDay();
            if (! $start->isMonday()) {
                throw ValidationException::withMessages(['week_start' => __('reports.week_start_monday')]);
            }
        } else {
            $start = $this->reports->lastFullWeekStart($user);
        }

        return response()->json($this->reports->weekly($user, $start));
    }

    public function heatmap(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $user = $request->user();

        $to = isset($data['to']) ? Carbon::parse($data['to']) : Carbon::parse($this->progress->today($user));
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $to->copy()->subDays(364);

        if ($from->gt($to)) {
            throw ValidationException::withMessages(['from' => __('reports.from_after_to')]);
        }
        if ($from->diffInDays($to) + 1 > 366) {
            throw ValidationException::withMessages(['from' => __('reports.range_too_long')]);
        }

        return response()->json(['days' => $this->reports->heatmap($user, $from, $to)]);
    }

    public function progress(Request $request): JsonResponse
    {
        $data = $request->validate(['days' => ['nullable', 'integer', 'between:7,365']]);

        return response()->json(['points' => $this->reports->progress($request->user(), (int) ($data['days'] ?? 30))]);
    }

    /** Extension: danh sách từ đang học (tiếng Anh) để gạch chân trên trang web. */
    public function highlightList(Request $request): JsonResponse
    {
        $words = UserWord::ownedBy($request->user())
            ->where('status', UserWord::STATUS_LEARNING)
            ->where('source_lang', 'en')
            ->orderBy('id')
            ->get(['id', 'text', 'normalized_text', 'kind', 'meaning'])
            ->map(fn (UserWord $w) => [
                'id' => $w->id, 'text' => $w->text, 'normalized_text' => $w->normalized_text,
                'kind' => $w->kind, 'meaning' => $w->meaning,
            ]);

        return response()->json(['generated_at' => ApiDate::format(now()), 'words' => $words]);
    }
}
