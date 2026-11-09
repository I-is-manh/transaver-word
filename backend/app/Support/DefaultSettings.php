<?php

namespace App\Support;

/**
 * Cài đặt mặc định của một người dùng mới (cột user_settings.settings), theo contract mục 6.1.
 * Mỗi khóa có value + source; source = "user" nghĩa là người dùng tự đặt, app không tự đổi nữa.
 */
final class DefaultSettings
{
    public const SCHEMA_VERSION = 1;

    /** @return array<string, mixed> giá trị phẳng */
    public static function values(): array
    {
        return [
            'daily_new_words' => 7,
            'reminder_time' => '21:00',
            'reminder_channels' => ['browser'],
            'exercise_types' => ['flashcard', 'mcq', 'cloze'],
            'save_page_url' => true,
            'daily_review_limit' => 150,
            'desired_retention' => 0.9,
            'card_display' => ['phonetic' => true, 'english_definition' => false, 'context_sentence' => true],
            'weekly_report' => true,
            'appearance' => 'system',
        ];
    }

    /** @return array<string, array{value: mixed, source: string}> */
    public static function make(): array
    {
        return array_map(fn ($v) => ['value' => $v, 'source' => 'default'], self::values());
    }
}
