<?php

namespace App\Services\Review;

use App\Fsrs\Fsrs;
use App\Http\Resources\ContextResource;
use App\Http\Resources\WordResource;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Support\UserSettings;
use DateTimeImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Dựng object Card (contract mục 5.2): chọn dạng bài, đáp án nhiễu, câu điền chỗ trống,
 * khoảng cách tới lần ôn tiếp cho từng mức đánh giá.
 */
class CardBuilder
{
    public const FLASHCARD = 'flashcard';

    public const MCQ = 'mcq';

    public const CLOZE = 'cloze';

    public const LISTENING = 'listening';

    public const DICTATION = 'dictation';

    public const TYPES = [self::FLASHCARD, self::MCQ, self::CLOZE, self::LISTENING, self::DICTATION];

    public function __construct(private readonly FsrsFactory $fsrsFactory) {}

    /**
     * @param  Collection<int, UserWord>  $words  đã load dictionaryEntry, contexts_count
     * @return list<array<string, mixed>>
     */
    public function build(User $user, Collection $words): array
    {
        if ($words->isEmpty()) {
            return [];
        }

        $enabled = array_values(array_unique(array_merge([self::FLASHCARD], (array) UserSettings::get($user, 'exercise_types'))));
        $fsrs = $this->fsrsFactory->for($user);
        $now = new DateTimeImmutable;
        $distractorPool = $this->distractorPool($user);
        $contexts = $this->contextsByWord($words);

        return $words->map(fn (UserWord $word) => $this->card(
            $word, $enabled, $fsrs, $now, $distractorPool, $contexts[$word->id] ?? collect(),
        ))->values()->all();
    }

    /**
     * @param  list<string>  $enabled
     * @param  list<string>  $pool
     * @param  Collection<int, WordContext>  $contexts  đã sắp: ít dùng gần đây trước
     * @return array<string, mixed>
     */
    private function card(UserWord $word, array $enabled, Fsrs $fsrs, DateTimeImmutable $now, array $pool, Collection $contexts): array
    {
        $threshold = (float) config('learning.exercise_stability_threshold');
        $type = $this->chooseType($word, $enabled, $threshold, $contexts);

        $options = null;
        $answerKey = null;
        if (in_array($type, [self::MCQ, self::LISTENING], true)) {
            [$options, $answerKey] = $this->options($word, $pool) ?? [null, null];
            if ($options === null) {
                $type = self::FLASHCARD; // không đủ 3 nghĩa khác để làm đáp án nhiễu
            }
        }

        $context = null;
        $cloze = null;
        $answerText = null;
        if ($type === self::CLOZE) {
            foreach ($contexts as $ctx) {
                if ($parts = $this->clozeParts($ctx, $word)) {
                    $context = $ctx;
                    $answerText = $parts['answer'];
                    $cloze = [
                        'before' => $parts['before'],
                        'after' => $parts['after'],
                        'hint' => $word->stability < $threshold ? mb_substr($answerText, 0, 1) : null,
                    ];
                    break;
                }
            }
        } elseif ($type === self::FLASHCARD) {
            $context = $contexts->first();
        } elseif ($type === self::DICTATION) {
            $answerText = $word->text;
        }

        $intervals = [];
        foreach ($fsrs->preview(FsrsFactory::cardFromWord($word), $now) as $rating => $next) {
            $intervals[(string) $rating] = $next->due->getTimestamp() - $now->getTimestamp();
        }

        return [
            'card_id' => $word->id.'-'.$type,
            'word' => new WordResource($word),
            'exercise_type' => $type,
            'context' => $context ? new ContextResource($context) : null,
            'cloze' => $cloze,
            'options' => $options,
            'answer_key' => $answerKey,
            'answer_text' => $answerText,
            'intervals' => $intervals,
        ];
    }

    /**
     * Mục 5.1: từ mới hoặc chưa có nghĩa → flashcard; stability < 7 → mcq/listening;
     * còn lại → cloze (nếu có câu dùng được)/dictation. Dạng bị tắt thì lùi về dạng dễ hơn đang bật.
     *
     * @param  list<string>  $enabled
     */
    private function chooseType(UserWord $word, array $enabled, float $threshold, Collection $contexts): string
    {
        if ($word->fsrs_state === 0 || $word->meaning === null || trim($word->meaning) === '') {
            return self::FLASHCARD;
        }

        $recognition = array_values(array_intersect([self::MCQ, self::LISTENING], $enabled));

        if ($word->stability >= $threshold) {
            $recall = [];
            if (in_array(self::CLOZE, $enabled, true) && $contexts->contains(fn ($c) => $this->clozeParts($c, $word) !== null)) {
                $recall[] = self::CLOZE;
            }
            if (in_array(self::DICTATION, $enabled, true)) {
                $recall[] = self::DICTATION;
            }
            if ($recall !== []) {
                return $recall[array_rand($recall)];
            }
        }

        return $recognition !== [] ? $recognition[array_rand($recognition)] : self::FLASHCARD;
    }

    /**
     * 4 phương án đã xáo trộn + key đúng, hoặc null nếu không đủ 3 đáp án nhiễu.
     *
     * @param  list<string>  $pool
     * @return array{0: list<array{key: string, text: string}>, 1: string}|null
     */
    private function options(UserWord $word, array $pool): ?array
    {
        $correct = trim((string) $word->meaning);
        $candidates = array_values(array_filter(
            array_unique($pool),
            fn ($m) => mb_strtolower($m) !== mb_strtolower($correct),
        ));
        if (count($candidates) < 3) {
            return null;
        }
        shuffle($candidates);

        $texts = array_merge([$correct], array_slice($candidates, 0, 3));
        shuffle($texts);

        $options = [];
        $answerKey = 'a';
        foreach (['a', 'b', 'c', 'd'] as $i => $key) {
            $options[] = ['key' => $key, 'text' => $texts[$i]];
            if ($texts[$i] === $correct) {
                $answerKey = $key;
            }
        }

        return [$options, $answerKey];
    }

    /** @return list<string> nghĩa các từ của người dùng (tối đa 200 mục ngẫu nhiên), làm đáp án nhiễu */
    private function distractorPool(User $user): array
    {
        return UserWord::ownedBy($user)
            ->whereNotNull('meaning')->where('meaning', '!=', '')
            ->inRandomOrder()->limit(200)
            ->pluck('meaning')->map(fn ($m) => trim($m))->unique()->values()->all();
    }

    /**
     * Ngữ cảnh của các từ, sắp theo: chưa dùng hoặc dùng lâu nhất trước (dựa vào review_logs).
     *
     * @param  Collection<int, UserWord>  $words
     * @return array<int, Collection<int, WordContext>>
     */
    private function contextsByWord(Collection $words): array
    {
        $ids = $words->pluck('id')->all();
        // Luôn đặt alias cho biểu thức gộp: PostgreSQL tự đặt tên cột "max", pluck theo biểu thức sẽ không thấy.
        $lastUsed = DB::table('review_logs')
            ->whereIn('user_word_id', $ids)->whereNotNull('word_context_id')
            ->selectRaw('word_context_id, MAX(reviewed_at) AS last_used')
            ->groupBy('word_context_id')
            ->pluck('last_used', 'word_context_id')
            ->map(fn ($t) => (string) $t);

        // Câu chưa dùng ('' đứng trước mọi thời điểm) hoặc dùng lâu nhất lên trước; cùng mức thì câu mới hơn trước.
        return WordContext::whereIn('user_word_id', $ids)->get()
            ->sortBy(fn (WordContext $c) => [$lastUsed[$c->id] ?? '', -$c->id])
            ->groupBy('user_word_id')
            ->all();
    }

    /**
     * Tách câu thành phần trước/sau và đoạn từ bị che. Vị trí word_offset/word_length tính theo
     * đơn vị UTF-16 (như JavaScript). Không có vị trí thì tìm từ trong câu (không phân biệt hoa thường).
     *
     * @return array{before: string, after: string, answer: string}|null
     */
    public function clozeParts(WordContext $ctx, UserWord $word): ?array
    {
        $sentence = $ctx->sentence;

        if ($ctx->word_offset !== null && $ctx->word_length !== null && $ctx->word_length > 0) {
            $utf16 = mb_convert_encoding($sentence, 'UTF-16LE', 'UTF-8');
            $start = $ctx->word_offset * 2;
            $len = $ctx->word_length * 2;
            if ($start + $len <= strlen($utf16)) {
                $answer = mb_convert_encoding(substr($utf16, $start, $len), 'UTF-8', 'UTF-16LE');
                if (trim($answer) !== '') {
                    return [
                        'before' => mb_convert_encoding(substr($utf16, 0, $start), 'UTF-8', 'UTF-16LE'),
                        'after' => mb_convert_encoding(substr($utf16, $start + $len), 'UTF-8', 'UTF-16LE'),
                        'answer' => $answer,
                    ];
                }
            }
        }

        $pos = mb_stripos($sentence, $word->text);
        if ($pos === false) {
            return null;
        }
        $length = mb_strlen($word->text);

        return [
            'before' => mb_substr($sentence, 0, $pos),
            'after' => mb_substr($sentence, $pos + $length),
            'answer' => mb_substr($sentence, $pos, $length),
        ];
    }
}
