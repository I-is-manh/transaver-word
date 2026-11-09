<?php

namespace App\Services;

use App\Models\DictionaryEntry;
use App\Support\TextNormalizer;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Tra từ điển, có cache trong bảng dictionary_entries (contract mục 3.4 bước 2 và mục 4).
 *
 * - Chỉ hỗ trợ tiếng Anh (Free Dictionary API).
 * - Không tìm thấy (404): vẫn lưu found = false để không gọi lại.
 * - Lỗi mạng, lỗi máy chủ hoặc quá thời gian chờ: bỏ qua, không lưu (lần sau thử lại).
 */
class DictionaryService
{
    public const PROVIDER = 'dictionaryapi.dev';

    private const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

    public const TIMEOUT_SECONDS = 3;

    /** @var list<string> */
    public const SUPPORTED_LANGS = ['en'];

    /**
     * Trả về entry đã cache hoặc vừa tra (kể cả found = false). Null khi ngôn ngữ không hỗ trợ
     * hoặc gọi API lỗi.
     */
    public function lookup(string $text, string $lang): ?DictionaryEntry
    {
        $lang = strtolower($lang);
        $normalized = TextNormalizer::word($text);

        if ($normalized === '' || ! in_array($lang, self::SUPPORTED_LANGS, true)) {
            return null;
        }

        $cached = DictionaryEntry::where('lang', $lang)->where('normalized_text', $normalized)->first();
        if ($cached) {
            return $cached;
        }

        $attributes = $this->fetch($normalized);
        if ($attributes === null) {
            return null;
        }

        return DictionaryEntry::createOrFirst(
            ['lang' => $lang, 'normalized_text' => $normalized],
            $attributes + ['text' => TextNormalizer::collapse($text), 'provider' => self::PROVIDER, 'fetched_at' => now()],
        );
    }

    /** Entry tìm thấy, ngược lại null (không tìm thấy, không hỗ trợ, lỗi). */
    public function find(string $text, string $lang): ?DictionaryEntry
    {
        $entry = $this->lookup($text, $lang);

        return $entry && $entry->found ? $entry : null;
    }

    /**
     * Gọi Free Dictionary API. Trả về các cột cần lưu, hoặc null nếu lỗi (không lưu).
     *
     * @return array<string, mixed>|null
     */
    private function fetch(string $normalized): ?array
    {
        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->connectTimeout(self::TIMEOUT_SECONDS)
                ->acceptJson()
                ->get(self::ENDPOINT.rawurlencode($normalized));
        } catch (ConnectionException $e) {
            Log::info('Từ điển quá thời gian hoặc mất kết nối', ['text' => $normalized, 'error' => $e->getMessage()]);

            return null;
        }

        if ($response->status() === 404) {
            return ['found' => false, 'phonetic' => null, 'audio_url' => null, 'parts_of_speech' => null, 'definitions' => null];
        }

        if (! $response->successful()) {
            Log::info('Từ điển trả lỗi', ['text' => $normalized, 'status' => $response->status()]);

            return null;
        }

        try {
            return $this->parse($response);
        } catch (Throwable $e) {
            Log::warning('Không đọc được dữ liệu từ điển', ['text' => $normalized, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /** @return array<string, mixed> */
    private function parse(Response $response): array
    {
        $entries = $response->json();
        if (! is_array($entries) || $entries === []) {
            return ['found' => false, 'phonetic' => null, 'audio_url' => null, 'parts_of_speech' => null, 'definitions' => null];
        }

        $phonetic = null;
        $audio = null;
        $parts = [];
        $definitions = [];

        foreach ($entries as $entry) {
            $phonetic ??= $this->nonEmpty($entry['phonetic'] ?? null);

            foreach ($entry['phonetics'] ?? [] as $p) {
                $phonetic ??= $this->nonEmpty($p['text'] ?? null);
                $audio ??= $this->nonEmpty($p['audio'] ?? null);
            }

            foreach ($entry['meanings'] ?? [] as $meaning) {
                $pos = $this->nonEmpty($meaning['partOfSpeech'] ?? null);
                if ($pos !== null && ! in_array($pos, $parts, true)) {
                    $parts[] = $pos;
                }

                foreach ($meaning['definitions'] ?? [] as $def) {
                    $text = $this->nonEmpty($def['definition'] ?? null);
                    if ($text === null) {
                        continue;
                    }
                    $definitions[] = [
                        'part_of_speech' => $pos,
                        'definition' => $text,
                        'example' => $this->nonEmpty($def['example'] ?? null),
                    ];
                }
            }
        }

        $found = $definitions !== [];

        return [
            'found' => $found,
            'phonetic' => $phonetic,
            'audio_url' => $audio,
            'parts_of_speech' => $found ? $parts : null,
            'definitions' => $found ? $definitions : null,
        ];
    }

    private function nonEmpty(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
