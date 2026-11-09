<?php

namespace App\Services\Ai;

use App\Contracts\ContextMeaning;
use App\Contracts\ContextMeaningService;

/** Bản mặc định: không gọi AI, luôn trả null (người dùng tự chọn nghĩa trong từ điển). */
class NullContextMeaningService implements ContextMeaningService
{
    public function meaningFor(string $text, string $sentence, string $sourceLang, string $targetLang): ?ContextMeaning
    {
        return null;
    }
}
