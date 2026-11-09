<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Một từ trong kho của một người. Xóa mềm = thùng rác. */
class UserWord extends Model
{
    use SoftDeletes;

    public const KIND_WORD = 'word';

    public const KIND_PHRASE = 'phrase';

    public const STATUS_LEARNING = 'learning';

    public const STATUS_KNOWN = 'known';

    public const FSRS_REVIEW = 2;

    protected $fillable = [
        'user_id', 'dictionary_entry_id', 'source_lang', 'target_lang', 'text', 'normalized_text',
        'kind', 'meaning', 'note', 'status',
    ];

    protected $attributes = [
        'kind' => self::KIND_WORD,
        'status' => self::STATUS_LEARNING,
        'fsrs_state' => 0,
        'stability' => 0,
        'difficulty' => 0,
        'elapsed_days' => 0,
        'scheduled_days' => 0,
        'reps' => 0,
        'lapses' => 0,
    ];

    protected function casts(): array
    {
        return [
            'fsrs_state' => 'integer',
            'stability' => 'float',
            'difficulty' => 'float',
            'reps' => 'integer',
            'lapses' => 'integer',
            'due_at' => 'datetime',
            'last_review_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dictionaryEntry(): BelongsTo
    {
        return $this->belongsTo(DictionaryEntry::class);
    }

    public function contexts(): HasMany
    {
        return $this->hasMany(WordContext::class);
    }

    public function decks(): BelongsToMany
    {
        return $this->belongsToMany(Deck::class, 'deck_words', 'user_word_id', 'deck_id');
    }

    /** "Đã thuộc": fsrs_state = Review và stability >= ngưỡng trong config/learning.php. */
    public function isMastered(): bool
    {
        return $this->fsrs_state === self::FSRS_REVIEW
            && $this->stability >= (float) config('learning.mastered_stability');
    }

    public function scopeOwnedBy(Builder $query, User $user): void
    {
        $query->where('user_id', $user->id);
    }
}
