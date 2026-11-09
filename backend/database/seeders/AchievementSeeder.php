<?php

namespace Database\Seeders;

use App\Models\Achievement;
use Illuminate\Database\Seeder;

/** Bộ huy hiệu khởi đầu (contract mục 8.1). Chạy lại nhiều lần không tạo trùng. */
class AchievementSeeder extends Seeder
{
    public const ACHIEVEMENTS = [
        ['code' => 'first_save', 'name' => 'Từ đầu tiên', 'description' => 'Lưu từ đầu tiên của bạn.', 'icon' => 'save', 'criteria' => ['type' => 'words_saved', 'gte' => 1], 'xp_reward' => 10, 'is_hidden' => false],
        ['code' => 'first_review', 'name' => 'Buổi ôn đầu tiên', 'description' => 'Hoàn thành buổi ôn đầu tiên.', 'icon' => 'review', 'criteria' => ['type' => 'sessions_finished', 'gte' => 1], 'xp_reward' => 10, 'is_hidden' => false],
        ['code' => 'streak_7', 'name' => 'Một tuần bền bỉ', 'description' => 'Học 7 ngày liên tiếp.', 'icon' => 'streak', 'criteria' => ['type' => 'streak', 'gte' => 7], 'xp_reward' => 50, 'is_hidden' => false],
        ['code' => 'streak_30', 'name' => 'Một tháng bền bỉ', 'description' => 'Học 30 ngày liên tiếp.', 'icon' => 'streak', 'criteria' => ['type' => 'streak', 'gte' => 30], 'xp_reward' => 200, 'is_hidden' => false],
        ['code' => 'mastered_50', 'name' => '50 từ vững', 'description' => 'Thuộc 50 từ.', 'icon' => 'badge', 'criteria' => ['type' => 'mastered', 'gte' => 50], 'xp_reward' => 100, 'is_hidden' => false],
        ['code' => 'mastered_250', 'name' => '250 từ vững', 'description' => 'Thuộc 250 từ.', 'icon' => 'badge', 'criteria' => ['type' => 'mastered', 'gte' => 250], 'xp_reward' => 300, 'is_hidden' => false],
        ['code' => 'sites_10', 'name' => 'Người đọc rộng', 'description' => 'Lưu từ từ 10 trang web khác nhau.', 'icon' => 'context', 'criteria' => ['type' => 'distinct_sites', 'gte' => 10], 'xp_reward' => 50, 'is_hidden' => true],
        ['code' => 'perfect_session', 'name' => 'Không sai câu nào', 'description' => 'Hoàn thành một buổi ôn từ 10 thẻ trở lên mà không quên thẻ nào.', 'icon' => 'check', 'criteria' => ['type' => 'perfect_session', 'min_cards' => 10], 'xp_reward' => 30, 'is_hidden' => true],
        ['code' => 'comeback', 'name' => 'Trở lại', 'description' => 'Quay lại ôn sau 7 ngày nghỉ trở lên.', 'icon' => 'calendar', 'criteria' => ['type' => 'comeback', 'gap_days' => 7], 'xp_reward' => 20, 'is_hidden' => true],
    ];

    public function run(): void
    {
        foreach (self::ACHIEVEMENTS as $a) {
            Achievement::updateOrCreate(['code' => $a['code']], $a);
        }
    }
}
