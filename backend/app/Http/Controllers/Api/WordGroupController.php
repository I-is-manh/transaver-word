<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Words\GroupWordsRequest;
use App\Models\UserWord;
use App\Queries\WordFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Gom nhóm "Từ của tôi" theo ngôn ngữ và thời gian (contract mục 3.11). */
class WordGroupController extends Controller
{
    public const MAX_GROUPS = 1000;

    /** Định dạng to_char của PostgreSQL cho từng cách nhóm. */
    private const FORMATS = ['day' => 'YYYY-MM-DD', 'month' => 'YYYY-MM', 'year' => 'YYYY'];

    /** GET /api/words/languages: ngôn ngữ nguồn đang có, không tính thùng rác. */
    public function languages(Request $request): JsonResponse
    {
        $rows = UserWord::ownedBy($request->user())
            ->selectRaw('source_lang AS lang, COUNT(*) AS n')
            ->groupBy('source_lang')
            ->orderByDesc('n')->orderBy('source_lang')
            ->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => ['lang' => $r->lang, 'count' => (int) $r->n])->all(),
        ]);
    }

    /** GET /api/words/groups?by=day|month|year: nhóm theo ngày lưu (múi giờ người dùng). */
    public function groups(GroupWordsRequest $request): JsonResponse
    {
        $user = $request->user();
        $by = $request->validated('by');
        $order = $request->validated('order') ?? 'desc';
        $tz = WordFilters::timezone($user);

        $rows = WordFilters::apply(UserWord::ownedBy($user), $user, $request->filters())
            ->selectRaw("to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE ?, ?) AS group_key, COUNT(*) AS n", [$tz, self::FORMATS[$by]])
            ->groupBy('group_key')
            ->orderBy('group_key', $order)
            ->limit(self::MAX_GROUPS)
            ->get();

        return response()->json([
            'by' => $by,
            'data' => $rows->map(fn ($r) => self::group($by, $r->group_key, (int) $r->n))->all(),
        ]);
    }

    /** @return array{key: string, from: string, to: string, count: int} */
    private static function group(string $by, string $key, int $count): array
    {
        [$from, $to] = match ($by) {
            'day' => [$key, $key],
            'month' => [Carbon::parse("{$key}-01")->toDateString(), Carbon::parse("{$key}-01")->endOfMonth()->toDateString()],
            'year' => ["{$key}-01-01", "{$key}-12-31"],
        };

        return ['key' => $key, 'from' => $from, 'to' => $to, 'count' => $count];
    }
}
