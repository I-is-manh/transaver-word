<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Từ điển dùng chung (Free Dictionary API). found = false nghĩa là đã tra nhưng không có,
 * vẫn lưu để không gọi API lại.
 *
 * definitions: list<array{part_of_speech: ?string, definition: string, example: ?string}>
 */
class DictionaryEntry extends Model
{
    protected $fillable = [
        'lang', 'text', 'normalized_text', 'found', 'phonetic', 'audio_url',
        'parts_of_speech', 'definitions', 'provider', 'fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'found' => 'boolean',
            'parts_of_speech' => 'array',
            'definitions' => 'array',
            'fetched_at' => 'datetime',
        ];
    }

    public function firstPartOfSpeech(): ?string
    {
        return $this->parts_of_speech[0] ?? null;
    }
}
