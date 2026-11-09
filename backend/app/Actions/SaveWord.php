<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Services\Ai\ContextMeaningResolver;
use App\Services\DailyActivityRecorder;
use App\Services\DictionaryService;
use App\Services\MeaningCandidates;
use App\Support\TextNormalizer;
use App\Support\UserSettings;
use Illuminate\Support\Facades\DB;

/**
 * Lưu từ từ nút "Lưu" của extension (contract mục 3.4, 6 bước).
 */
class SaveWord
{
    public function __construct(
        private readonly DictionaryService $dictionary,
        private readonly DailyActivityRecorder $activity,
        private readonly MeaningCandidates $candidates,
        private readonly ContextMeaningResolver $contextMeaning,
    ) {}

    /**
     * @param  array{text: string, source_lang: string, target_lang: string, sentence: string,
     *               word_offset?: ?int, word_length?: ?int, page_title?: ?string, page_url?: ?string, translation?: ?string}  $data
     * @return array{word: UserWord, context: WordContext, word_created: bool, context_created: bool, meaning_candidates: array}
     */
    public function handle(User $user, array $data): array
    {
        // Bước 1: chuẩn hóa
        $text = TextNormalizer::collapse($data['text']);
        $normalized = TextNormalizer::word($text);
        $sourceLang = strtolower($data['source_lang']);
        $targetLang = strtolower($data['target_lang']);
        $sentence = TextNormalizer::collapse($data['sentence']);
        $translation = isset($data['translation']) ? TextNormalizer::collapse((string) $data['translation']) : null;
        $translation = $translation === '' ? null : $translation;

        // Bước 2: từ điển (gọi mạng, nằm ngoài transaction). Lỗi thì trả null, vẫn lưu từ.
        $entry = $this->dictionary->lookup($normalized, $sourceLang);
        $foundEntry = $entry && $entry->found ? $entry : null;

        // Nghĩa theo ngữ cảnh bằng AI (nếu chủ sản phẩm đã cắm provider). Ngoài transaction, có cache, lỗi → null.
        $ai = $this->contextMeaning->resolve($text, $sentence, $sourceLang, $targetLang);
        $contextMeaning = $ai?->meaning ?? $translation;
        $contextSource = $ai ? WordContext::SOURCE_AI : ($translation !== null ? WordContext::SOURCE_TRANSLATION : null);

        $savePageUrl = (bool) UserSettings::get($user, 'save_page_url');

        [$word, $context, $wordCreated, $contextCreated] = DB::transaction(function () use (
            $user, $text, $normalized, $sourceLang, $targetLang, $sentence, $contextMeaning, $contextSource, $foundEntry, $savePageUrl, $data
        ) {
            // Bước 3: tìm cả dòng trong thùng rác; có thì khôi phục, chưa có thì tạo.
            $key = [
                'user_id' => $user->id,
                'source_lang' => $sourceLang,
                'target_lang' => $targetLang,
                'normalized_text' => $normalized,
            ];

            $word = UserWord::withTrashed()->where($key)->lockForUpdate()->first();
            if ($word === null) {
                $word = UserWord::withTrashed()->createOrFirst($key, [
                    'text' => $text,
                    'kind' => TextNormalizer::isPhrase($normalized) ? UserWord::KIND_PHRASE : UserWord::KIND_WORD,
                ]);
            }
            $wordCreated = $word->wasRecentlyCreated;

            if ($word->trashed()) {
                $word->restore();
            }
            if ($foundEntry && $word->dictionary_entry_id === null) {
                $word->dictionary_entry_id = $foundEntry->id;
            }

            // Bước 4: thêm câu, trùng sentence_hash thì dùng câu đã có.
            $context = WordContext::createOrFirst(
                ['user_word_id' => $word->id, 'sentence_hash' => TextNormalizer::sentenceHash($sentence)],
                [
                    'user_id' => $user->id,
                    'sentence' => $sentence,
                    'word_offset' => $data['word_offset'] ?? null,
                    'word_length' => $data['word_length'] ?? null,
                    // Người dùng tắt lưu link: bỏ cả link lẫn tiêu đề trang (contract v0.4).
                    'page_title' => $savePageUrl && isset($data['page_title']) ? TextNormalizer::collapse($data['page_title']) : null,
                    'page_url' => $savePageUrl ? ($data['page_url'] ?? null) : null,
                    // Bước 5: câu mới luôn giữ nghĩa riêng của câu (AI nếu có, không thì bản dịch).
                    'meaning' => $contextMeaning,
                    'meaning_source' => $contextSource,
                ],
            );
            $contextCreated = $context->wasRecentlyCreated;

            // Bước 5: nghĩa chính của từ chỉ đặt khi đang trống.
            if ($contextMeaning !== null && $word->meaning === null) {
                $word->meaning = $contextMeaning;
            }

            $word->save();

            return [$word, $context, $wordCreated, $contextCreated];
        });

        // Bước 6: chỉ đếm khi tạo từ mới.
        if ($wordCreated) {
            $this->activity->increment($user, 'words_saved');
        }

        $word->load(['dictionaryEntry', 'decks'])->loadCount('contexts');

        return [
            'word' => $word,
            'context' => $context,
            'word_created' => $wordCreated,
            'context_created' => $contextCreated,
            'meaning_candidates' => $this->candidates->build($translation, $foundEntry),
        ];
    }
}
