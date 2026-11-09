<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Một buổi ôn. */
class ReviewSession extends Model
{
    public const MODE_DAILY = 'daily';

    public const MODE_EXTRA = 'extra';

    public const MODE_HARD = 'hard';

    public const MODE_DECK = 'deck';

    public $timestamps = false;

    protected $fillable = ['user_id', 'mode', 'deck_id', 'started_at', 'ended_at'];

    protected $attributes = [
        'cards_reviewed' => 0,
        'new_cards' => 0,
        'correct_count' => 0,
        'duration_seconds' => 0,
        'xp_earned' => 0,
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'cards_reviewed' => 'integer',
            'new_cards' => 'integer',
            'correct_count' => 'integer',
            'duration_seconds' => 'integer',
            'xp_earned' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ReviewLog::class, 'session_id');
    }
}
