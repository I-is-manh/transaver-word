<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Services\DictionaryService;
use App\Support\TextNormalizer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sửa một từ trong "Từ của tôi" (contract mục 3.7). Đổi chữ thì giữ nguyên lịch ôn FSRS và lịch sử ôn,
 * tra lại từ điển và tính lại vị trí của từ trong mọi câu ngữ cảnh.
 */
class UpdateWord
{
    public function __construct(private readonly DictionaryService $dictionary) {}

    /** @param array{text?: string, meaning?: ?string, kind?: string, note?: ?string, status?: string} $data */
    public function handle(User $user, UserWord $word, array $data): UserWord
    {
        $changes = array_intersect_key($data, array_flip(['meaning', 'kind', 'note', 'status']));
        $newText = null;
        $entryId = $word->dictionary_entry_id;

        if (array_key_exists('text', $data)) {
            $text = TextNormalizer::collapse($data['text']);
            $normalized = TextNormalizer::word($text);

            if ($normalized === $word->normalized_text) {
                $changes['text'] = $text; // chỉ đổi hoa thường hoặc khoảng trắng
            } else {
                $this->assertNotDuplicate($user, $word, $normalized);

                // Tra từ điển ngoài transaction. Không tìm thấy, lỗi hoặc ngôn ngữ không hỗ trợ → null
                // (không giữ entry cũ, vì phiên âm của từ cũ sẽ sai với từ mới).
                $entry = $this->dictionary->lookup($normalized, $word->source_lang);
                $entryId = $entry && $entry->found ? $entry->id : null;

                $newText = $text;
                $changes['text'] = $text;
                $changes['normalized_text'] = $normalized;
                if (! array_key_exists('kind', $data)) {
                    $changes['kind'] = TextNormalizer::isPhrase($normalized) ? UserWord::KIND_PHRASE : UserWord::KIND_WORD;
                }
            }
        }

        try {
            DB::transaction(function () use ($word, $changes, $newText, $entryId) {
                $locked = UserWord::whereKey($word->id)->lockForUpdate()->firstOrFail();
                $locked->forceFill($changes);
                if ($newText !== null) {
                    $locked->dictionary_entry_id = $entryId;
                    $this->relocateContexts($locked, $newText);
                }
                $locked->save();
            });
        } catch (UniqueConstraintViolationException) {
            // Request khác vừa lưu đúng từ này.
            throw ValidationException::withMessages(['text' => __('words.duplicate')]);
        }

        return $word->refresh();
    }

    private function assertNotDuplicate(User $user, UserWord $word, string $normalized): void
    {
        $other = UserWord::withTrashed()
            ->where('user_id', $user->id)
            ->where('source_lang', $word->source_lang)
            ->where('target_lang', $word->target_lang)
            ->where('normalized_text', $normalized)
            ->whereKeyNot($word->id)
            ->first();

        if ($other !== null) {
            throw ValidationException::withMessages([
                'text' => __($other->trashed() ? 'words.duplicate_in_trash' : 'words.duplicate'),
            ]);
        }
    }

    /** Tính lại word_offset/word_length (UTF-16) của mọi câu theo chữ mới; không thấy thì null. */
    private function relocateContexts(UserWord $word, string $text): void
    {
        WordContext::where('user_word_id', $word->id)->get()->each(function (WordContext $ctx) use ($text) {
            $loc = TextNormalizer::locateUtf16($ctx->sentence, $text);
            $ctx->forceFill([
                'word_offset' => $loc['offset'] ?? null,
                'word_length' => $loc['length'] ?? null,
            ])->save();
        });
    }
}
