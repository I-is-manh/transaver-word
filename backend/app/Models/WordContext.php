<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Một câu người dùng đã gặp từ đó. */
class WordContext extends Model
{
    public const SOURCE_TRANSLATION = 'translation';

    public const SOURCE_DICTIONARY = 'dictionary';

    public const SOURCE_USER = 'user';

    public const SOURCE_AI = 'ai';

    protected $fillable = [
        'user_word_id', 'user_id', 'sentence', 'sentence_hash', 'word_offset', 'word_length',
        'meaning', 'meaning_source', 'page_title', 'page_url',
    ];

    protected function casts(): array
    {
        return [
            'word_offset' => 'integer',
            'word_length' => 'integer',
        ];
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(UserWord::class, 'user_word_id');
    }
}
