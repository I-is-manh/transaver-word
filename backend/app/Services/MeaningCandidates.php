<?php

namespace App\Services;

use App\Models\DictionaryEntry;

/** Danh sách nghĩa gợi ý để người dùng chọn (contract mục 3.3, phương án A). */
class MeaningCandidates
{
    public const MAX = 8;

    /**
     * @param  string|null  $first  Nghĩa đứng đầu (bản dịch extension gửi, hoặc nghĩa hiện tại của từ)
     * @param  string  $firstKey  key của mục đứng đầu
     * @return list<array{key: string, source: string, part_of_speech: ?string, text: string, example: ?string}>
     */
    public function build(?string $first, ?DictionaryEntry $entry, string $firstKey = 'translation'): array
    {
        $items = [];

        if ($first !== null && trim($first) !== '') {
            $items[] = [
                'key' => $firstKey,
                'source' => 'translation',
                'part_of_speech' => null,
                'text' => trim($first),
                'example' => null,
            ];
        }

        if ($entry && $entry->found) {
            foreach ($entry->definitions ?? [] as $i => $def) {
                $items[] = [
                    'key' => 'dictionary-'.$i,
                    'source' => 'dictionary',
                    'part_of_speech' => $def['part_of_speech'] ?? null,
                    'text' => $def['definition'],
                    'example' => $def['example'] ?? null,
                ];
            }
        }

        return array_slice($items, 0, self::MAX);
    }
}
