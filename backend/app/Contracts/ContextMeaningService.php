<?php

namespace App\Contracts;

/**
 * Chọn nghĩa đúng của một từ trong một câu cụ thể ("nghĩa theo ngữ cảnh").
 *
 * Mặc định dùng NullContextMeaningService (không gọi AI, luôn trả null): người dùng tự chọn nghĩa
 * trong từ điển (phương án A). Khi muốn bật AI (phương án C trong docs/implementation-plan.html):
 *
 *   1. Viết một class implement interface này, ví dụ App\Services\Ai\AnthropicContextMeaningService.
 *      - Gọi API qua Http facade (hoặc SDK chính thức), timeout ngắn (khoảng 5 giây).
 *      - Đọc API key từ config('services.ai.api_key'), KHÔNG để key trong code hay trong extension.
 *      - Prompt: gửi từ, câu, cặp ngôn ngữ; yêu cầu trả đúng một nghĩa ngắn bằng ngôn ngữ đích.
 *      - Lỗi mạng hoặc trả về không hợp lệ: ném exception hoặc trả null. Lưu từ vẫn chạy bình thường.
 *   2. Khai báo class trong config/services.php → 'ai' → 'providers', ví dụ 'anthropic' => AnthropicContextMeaningService::class.
 *   3. Đặt AI_PROVIDER=anthropic, AI_API_KEY=..., AI_MODEL=... trong .env.
 *
 * Không cần sửa SaveWord: ContextMeaningResolver đã lo cache (bảng context_meaning_cache, khóa băm
 * nên không lưu câu gốc) và bắt lỗi. Nên giới hạn số lượt gọi mỗi ngày cho mỗi người dùng
 * (RateLimiter) trong class provider để kiểm soát chi phí.
 */
interface ContextMeaningService
{
    public function meaningFor(string $text, string $sentence, string $sourceLang, string $targetLang): ?ContextMeaning;
}
