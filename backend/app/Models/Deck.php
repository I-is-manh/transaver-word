<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Bộ từ người dùng tự tạo. */
class Deck extends Model
{
    protected $fillable = ['user_id', 'name', 'color'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function words(): BelongsToMany
    {
        return $this->belongsToMany(UserWord::class, 'deck_words', 'deck_id', 'user_word_id')->withPivot('added_at');
    }
}
