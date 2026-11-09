<?php

/*
| Các ngưỡng nghiệp vụ của việc học. Để ở đây để chỉnh mà không phải sửa code.
| Xem docs/api-contract.md mục 5–8 và docs/orchestration-plan.md mục 8.
*/

return [

    // Từ trong thùng rác quá số ngày này sẽ bị job hằng ngày xóa hẳn.
    'trash_days' => (int) env('LEARNING_TRASH_DAYS', 30),

    // "Đã thuộc": fsrs_state = 2 (Review) và stability >= ngưỡng này (ngày).
    'mastered_stability' => (float) env('LEARNING_MASTERED_STABILITY', 21),

    // "Từ khó": lapses >= ngưỡng này. Buổi ôn từ khó lấy tối đa hard_session_limit thẻ.
    'hard_lapses' => (int) env('LEARNING_HARD_LAPSES', 3),
    'hard_session_limit' => 20,

    // Thẻ đóng băng: giữ tối đa max_freezes thẻ, được 1 thẻ sau mỗi freeze_every_days ngày liên tiếp.
    'max_freezes' => (int) env('LEARNING_MAX_FREEZES', 2),
    'freeze_every_days' => (int) env('LEARNING_FREEZE_EVERY_DAYS', 7),

    // Múi giờ mặc định khi người dùng không gửi timezone lúc đăng ký.
    'default_timezone' => 'Asia/Ho_Chi_Minh',

    // Chọn dạng bài (contract mục 5.1): stability < ngưỡng → mcq/listening, ngược lại cloze/dictation.
    // Cloze gợi ý chữ cái đầu khi stability < ngưỡng này.
    'exercise_stability_threshold' => 7,

    // FSRS: bước học ngắn hạn (phút), giới hạn khoảng cách (ngày).
    'fsrs' => [
        'learning_steps' => [1, 10],
        'relearning_steps' => [10],
        'maximum_interval' => 36500,
    ],

    // XP (contract mục 5.6): chỉ thưởng cho việc nhớ đúng.
    'xp' => [
        'rating' => [1 => 0, 2 => 5, 3 => 10, 4 => 10],
        'mastered_bonus' => 50,
        // Cấp n cần tổng level_base·n·(n−1) XP: cấp 1 = 0, cấp 2 = 100, cấp 3 = 300…
        'level_base' => 50,
    ],

    // Buổi ôn dài hơn mức này (giây) chỉ tính bằng mức này (người dùng để tab mở rồi quên).
    'max_session_seconds' => 2 * 60 * 60,

    // Token "đăng nhập với tư cách người khác" của superadmin hết hạn sau số phút này (contract mục 9.1).
    'impersonation_minutes' => (int) env('LEARNING_IMPERSONATION_MINUTES', 120),

    // Link xác nhận email hết hạn sau số giờ này (contract mục 2.7).
    'email_verify_hours' => 24,
];
