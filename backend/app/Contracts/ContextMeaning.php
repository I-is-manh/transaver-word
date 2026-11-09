<?php

namespace App\Contracts;

/** Kết quả nghĩa theo ngữ cảnh do AI trả về. */
final class ContextMeaning
{
    public function __construct(
        /** Nghĩa ngắn gọn của từ trong câu, bằng ngôn ngữ đích (tối đa 500 ký tự). */
        public readonly string $meaning,
        /** Tên model đã dùng, lưu vào context_meaning_cache.model để biết khi nào cần làm mới. */
        public readonly string $model,
    ) {}
}
