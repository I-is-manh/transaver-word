<?php

namespace App\Services\Ai;

use App\Contracts\ContextMeaning;
use App\Contracts\ContextMeaningService;
use App\Support\TextNormalizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Bọc ContextMeaningService: tra cache context_meaning_cache trước, chỉ gọi provider khi chưa có,
 * bắt mọi lỗi để việc lưu từ không bao giờ hỏng vì AI.
 */
class ContextMeaningResolver
{
    public function __construct(private readonly ContextMeaningService $provider) {}

    public function enabled(): bool
    {
        return ! $this->provider instanceof NullContextMeaningService;
    }

    public function resolve(string $text, string $sentence, string $sourceLang, string $targetLang): ?ContextMeaning
    {
        if (! $this->enabled()) {
            return null;
        }

        $key = self::cacheKey($text, $sentence, $sourceLang, $targetLang);
        $cached = DB::table('context_meaning_cache')->where('cache_key', $key)->first();
        if ($cached) {
            return new ContextMeaning($cached->meaning, $cached->model);
        }

        try {
            $result = $this->provider->meaningFor($text, $sentence, $sourceLang, $targetLang);
        } catch (Throwable $e) {
            Log::warning('Không lấy được nghĩa theo ngữ cảnh từ AI', ['error' => $e->getMessage()]);

            return null;
        }

        $meaning = $result ? mb_substr(trim($result->meaning), 0, 500) : '';
        if ($meaning === '') {
            return null;
        }

        DB::table('context_meaning_cache')->insertOrIgnore([
            'cache_key' => $key, 'meaning' => $meaning, 'model' => mb_substr($result->model, 0, 50), 'created_at' => now(),
        ]);

        return new ContextMeaning($meaning, $result->model);
    }

    /** SHA-256 của lang + từ + câu đã chuẩn hóa + target_lang (không lưu câu gốc). */
    public static function cacheKey(string $text, string $sentence, string $sourceLang, string $targetLang): string
    {
        return hash('sha256', implode("\x1F", [
            strtolower($sourceLang), TextNormalizer::word($text), mb_strtolower(TextNormalizer::collapse($sentence)), strtolower($targetLang),
        ]));
    }
}
