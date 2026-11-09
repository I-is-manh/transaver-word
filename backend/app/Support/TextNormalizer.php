<?php

namespace App\Support;

final class TextNormalizer
{
    /** Cắt khoảng trắng hai đầu, gộp khoảng trắng giữa thành một dấu cách. */
    public static function collapse(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    /** normalized_text của một từ: collapse + chữ thường (contract mục 3.4 bước 1). */
    public static function word(string $text): string
    {
        return mb_strtolower(self::collapse($text));
    }

    public static function isPhrase(string $normalized): bool
    {
        return str_contains($normalized, ' ');
    }

    /**
     * Tìm $needle trong $sentence (không phân biệt hoa thường). Trả vị trí và độ dài theo đơn vị
     * UTF-16 như JavaScript (khớp word_offset/word_length), hoặc null nếu không thấy.
     *
     * @return array{offset: int, length: int}|null
     */
    public static function locateUtf16(string $sentence, string $needle): ?array
    {
        $needle = self::collapse($needle);
        if ($needle === '') {
            return null;
        }
        $pos = mb_stripos($sentence, $needle);
        if ($pos === false) {
            return null;
        }
        $units = fn (string $s) => intdiv(strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);

        return [
            'offset' => $units(mb_substr($sentence, 0, $pos)),
            'length' => $units(mb_substr($sentence, $pos, mb_strlen($needle))),
        ];
    }

    /** SHA-256 của câu đã chuẩn hóa: cùng câu khác hoa thường hay khoảng trắng coi là trùng. */
    public static function sentenceHash(string $sentence): string
    {
        return hash('sha256', mb_strtolower(self::collapse($sentence)));
    }
}
