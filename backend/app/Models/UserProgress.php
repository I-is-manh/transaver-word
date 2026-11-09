<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProgress extends Model
{
    protected $table = 'user_progress';

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'current_streak',
        'longest_streak',
        'last_active_date',
        'freezes_available',
        'total_xp',
    ];

    protected $attributes = [
        'current_streak' => 0,
        'longest_streak' => 0,
        'freezes_available' => 0,
        'total_xp' => 0,
    ];

    protected function casts(): array
    {
        return ['last_active_date' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
