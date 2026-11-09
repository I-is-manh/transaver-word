<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Danh mục huy hiệu (nạp bằng AchievementSeeder). */
class Achievement extends Model
{
    protected $fillable = ['code', 'name', 'description', 'icon', 'criteria', 'xp_reward', 'is_hidden'];

    protected function casts(): array
    {
        return ['criteria' => 'array', 'xp_reward' => 'integer', 'is_hidden' => 'boolean'];
    }
}
