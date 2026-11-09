<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Một lần trả lời thẻ. Chỉ thêm, không sửa. */
class ReviewLog extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_correct' => 'boolean',
            'state_before' => 'integer',
            'stability_after' => 'float',
            'difficulty_after' => 'float',
            'due_after' => 'datetime',
            'xp_earned' => 'integer',
            'became_mastered' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(UserWord::class, 'user_word_id');
    }
}
