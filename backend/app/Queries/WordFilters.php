<?php

namespace App\Queries;

use App\Models\Deck;
use App\Models\User;
use App\Models\UserWord;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Bộ lọc dùng chung cho GET /words và GET /words/groups (contract mục 3.5, 3.11), để hai nơi
 * luôn đếm cùng một tập từ.
 */
final class WordFilters
{
    /**
     * @param  Builder<UserWord>  $query  đã giới hạn theo người dùng
     * @param  array<string, mixed>  $f  q, status, kind, hard, deck_id, lang, saved_from, saved_to
     * @return Builder<UserWord>
     */
    public static function apply(Builder $query, User $user, array $f): Builder
    {
        if (! empty($f['q'])) {
            $like = '%'.addcslashes(mb_strtolower(trim($f['q'])), '\\%_').'%';
            $query->where(fn (Builder $w) => $w
                ->where('normalized_text', 'like', $like)
                ->orWhereRaw('LOWER(meaning) LIKE ?', [$like]));
        }
        if (! empty($f['status'])) {
            $query->where('status', $f['status']);
        }
        if (! empty($f['kind'])) {
            $query->where('kind', $f['kind']);
        }
        if (! empty($f['hard'])) {
            $query->where('status', UserWord::STATUS_LEARNING)
                ->where('lapses', '>=', (int) config('learning.hard_lapses'));
        }
        if (! empty($f['deck_id'])) {
            $deck = Deck::where('user_id', $user->id)->findOrFail($f['deck_id']); // deck người khác → 404
            $query->whereIn('id', DB::table('deck_words')->where('deck_id', $deck->id)->select('user_word_id'));
        }
        if (! empty($f['lang'])) {
            $query->where('source_lang', strtolower($f['lang']));
        }

        // Khoảng ngày lưu theo múi giờ người dùng, tính cả hai đầu → so với created_at (UTC).
        $tz = self::timezone($user);
        if (! empty($f['saved_from'])) {
            $query->where('created_at', '>=', Carbon::parse($f['saved_from'], $tz)->startOfDay()->utc());
        }
        if (! empty($f['saved_to'])) {
            $query->where('created_at', '<', Carbon::parse($f['saved_to'], $tz)->addDay()->startOfDay()->utc());
        }

        return $query;
    }

    public static function timezone(User $user): string
    {
        return $user->timezone ?: config('learning.default_timezone');
    }
}
