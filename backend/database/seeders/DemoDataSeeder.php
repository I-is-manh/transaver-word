<?php

namespace Database\Seeders;

use App\Actions\CreateUser;
use App\Models\Deck;
use App\Models\DictionaryEntry;
use App\Models\ReviewSession;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Services\AchievementService;
use App\Services\DailyActivityRecorder;
use App\Services\ProgressService;
use App\Services\Review\ReviewService;
use App\Support\TextNormalizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Dữ liệu demo cho demo@transaver.local: 60 từ, 45 ngày học giả lập.
 *
 * Chạy riêng: php artisan db:seed --class=DemoDataSeeder (KHÔNG nằm trong DatabaseSeeder).
 * Chạy lại sẽ xóa dữ liệu học cũ của tài khoản demo rồi sinh lại (cùng kết quả vì dùng seed cố định).
 *
 * Mọi trạng thái được sinh bằng chính các service thật (FSRS, streak, XP, huy hiệu) với
 * Carbon::setTestNow lùi về từng ngày, nên số liệu nhất quán với nhau. Không gọi mạng.
 */
class DemoDataSeeder extends Seeder
{
    private const EMAIL = 'demo@transaver.local';

    private const DAYS = 45;

    private const TZ = 'Asia/Ho_Chi_Minh';

    /** Ngày (tính từ ngày đầu, 0-based) không học: tạo khoảng trống trong heatmap và dùng thẻ đóng băng. */
    private const SKIPPED_DAYS = [5, 6, 13, 19, 20, 21, 30];

    /** Các từ hay quên, để có "từ khó" (lapses ≥ 3). */
    private const HARD_WORDS = ['juxtapose', 'quintessential', 'jeopardize', 'meticulous', 'ubiquitous'];

    public function run(CreateUser $createUser, ReviewService $review, ProgressService $progress, DailyActivityRecorder $activity, AchievementService $achievements): void
    {
        mt_srand(20261108);
        $realNow = Carbon::now();
        $user = User::where('email', self::EMAIL)->first()
            ?? $createUser->handle(['email' => self::EMAIL, 'name' => 'Demo', 'password' => 'password123', 'timezone' => self::TZ, 'email_verified_at' => now()]);

        $this->reset($user);
        $user->forceFill(['timezone' => self::TZ, 'onboarding_completed_at' => $realNow->copy()->subDays(self::DAYS)])->save();

        $words = require __DIR__.'/data/demo_words.php';
        $today = Carbon::now(self::TZ)->startOfDay();
        $start = $today->copy()->subDays(self::DAYS);

        // Phân bổ 60 từ: lưu dần trong 45 ngày; 4 từ cuối lưu sáng nay (còn là từ mới, chưa học).
        $saveDay = [];
        foreach ($words as $i => $w) {
            $saveDay[$i] = $i < 56 ? (int) floor($i * (self::DAYS - 1) / 56) : self::DAYS;
        }

        try {
            for ($d = 0; $d < self::DAYS; $d++) {
                $day = $start->copy()->addDays($d);

                // Lưu từ trong ngày (kể cả ngày không ôn)
                foreach ($saveDay as $i => $sd) {
                    if ($sd === $d) {
                        $this->at($day, 9 + ($i % 12), ($i * 7) % 60);
                        $this->saveWord($user, $words[$i], $activity);
                        $achievements->check($user, AchievementService::EVENT_WORD_SAVED);
                    }
                }

                if (in_array($d, self::SKIPPED_DAYS, true)) {
                    continue;
                }

                // Buổi ôn buổi tối: từ đến hạn + từ mới theo mục tiêu
                $this->at($day, 20, 0);
                $this->studySession($user, $review, $progress);

                // Ôn lại các thẻ ở bước học ngắn (1–10 phút) trong cùng buổi tối
                $this->at($day, 20, 30);
                $this->studySession($user, $review, $progress, onlyLearning: true);
            }

            // Hôm nay: lưu 4 từ buổi sáng, chưa ôn (để thử buổi ôn, từ mới và nhắc học).
            foreach ($saveDay as $i => $sd) {
                if ($sd === self::DAYS) {
                    $this->at($today, 7, 10 + $i - 56);
                    $this->saveWord($user, $words[$i], $activity);
                }
            }
            $this->at($today, 8, 30);
            $progress->streak($user); // tính lại streak tới hôm nay
        } finally {
            Carbon::setTestNow();
        }

        $this->finishTouches($user);
    }

    private function reset(User $user): void
    {
        DB::transaction(function () use ($user) {
            UserWord::withTrashed()->where('user_id', $user->id)->forceDelete();
            Deck::where('user_id', $user->id)->delete();
            ReviewSession::where('user_id', $user->id)->delete();
            DB::table('daily_activity')->where('user_id', $user->id)->delete();
            DB::table('user_achievements')->where('user_id', $user->id)->delete();
            DB::table('notification_logs')->where('user_id', $user->id)->delete();
            DB::table('user_progress')->where('user_id', $user->id)
                ->update(['current_streak' => 0, 'longest_streak' => 0, 'last_active_date' => null, 'freezes_available' => 0, 'total_xp' => 0]);
        });
    }

    private function at(Carbon $localDay, int $hour, int $minute): void
    {
        Carbon::setTestNow($localDay->copy()->setTime($hour, $minute)->utc());
    }

    /** @param array{0: string, 1: ?string, 2: ?string, 3: string, 4: ?string, 5: string, 6: string} $w */
    private function saveWord(User $user, array $w, DailyActivityRecorder $activity): void
    {
        [$text, $phonetic, $pos, $meaning, $definition, $sentence, $host] = $w;
        $normalized = TextNormalizer::word($text);

        $entry = DictionaryEntry::updateOrCreate(
            ['lang' => 'en', 'normalized_text' => $normalized],
            [
                'text' => $text, 'found' => $definition !== null, 'phonetic' => $phonetic, 'audio_url' => null,
                'parts_of_speech' => $pos ? [$pos] : null,
                'definitions' => $definition ? [['part_of_speech' => $pos, 'definition' => $definition, 'example' => null]] : null,
                'provider' => 'demo', 'fetched_at' => now(),
            ],
        );

        $word = UserWord::create([
            'user_id' => $user->id, 'dictionary_entry_id' => $entry->found ? $entry->id : null,
            'source_lang' => 'en', 'target_lang' => 'vi', 'text' => $text, 'normalized_text' => $normalized,
            'kind' => TextNormalizer::isPhrase($normalized) ? UserWord::KIND_PHRASE : UserWord::KIND_WORD,
            'meaning' => $meaning,
        ]);

        // Vị trí từ trong câu (câu toàn ASCII nên đơn vị UTF-16 = ký tự)
        $first = strtok($text, ' ');
        $offset = mb_stripos($sentence, $first);
        $slug = Str::slug(Str::words($sentence, 5, ''));

        WordContext::create([
            'user_word_id' => $word->id, 'user_id' => $user->id,
            'sentence' => $sentence, 'sentence_hash' => TextNormalizer::sentenceHash($sentence),
            'word_offset' => $offset === false || $first !== $text ? null : $offset,
            'word_length' => $offset === false || $first !== $text ? null : mb_strlen($text),
            'meaning' => $meaning, 'meaning_source' => WordContext::SOURCE_TRANSLATION,
            'page_title' => Str::headline(Str::words($sentence, 6, '')),
            'page_url' => "https://www.{$host}/{$slug}",
        ]);

        $activity->increment($user, 'words_saved');
    }

    private function studySession(User $user, ReviewService $review, ProgressService $progress, bool $onlyLearning = false): void
    {
        $due = $progress->dueQuery($user)->where('due_at', '<=', now())->orderBy('due_at')->get();
        if ($onlyLearning) {
            $due = $due->filter(fn (UserWord $w) => in_array($w->fsrs_state, [1, 3], true));
        }
        $new = $onlyLearning ? collect() : UserWord::ownedBy($user)->where('status', 'learning')->where('fsrs_state', 0)
            ->orderBy('created_at')->orderBy('id')->limit($progress->newAllowanceToday($user))->get();

        $cards = $due->concat($new)->values();
        if ($cards->isEmpty()) {
            return;
        }

        $session = ReviewSession::create(['user_id' => $user->id, 'mode' => 'daily', 'started_at' => now()]);
        foreach ($cards as $i => $word) {
            Carbon::setTestNow(now()->addSeconds(25));
            $type = $word->fsrs_state === 0 ? 'flashcard' : ['mcq', 'flashcard', 'cloze'][$i % 3];
            $review->answer($user, $session, $word, [
                'client_uuid' => (string) Str::uuid(),
                'session_id' => $session->id,
                'user_word_id' => $word->id,
                'exercise_type' => $type,
                'rating' => $this->rating($word),
                'is_correct' => null,
                'answer' => null,
                // Như Front-end thật: flashcard và cloze gửi kèm câu đã dùng.
                'word_context_id' => $type === 'mcq' ? null : $word->contexts()->value('id'),
            ]);
        }
        $review->finish($user, $session->fresh());
    }

    /** Đánh giá giả lập: từ khó hay quên, từ khác phần lớn nhớ được. */
    private function rating(UserWord $word): int
    {
        if ($word->fsrs_state === 0) {
            return mt_rand(1, 100) <= 15 ? 4 : 3;
        }
        $roll = mt_rand(1, 100);
        if (in_array($word->normalized_text, self::HARD_WORDS, true)) {
            return $roll <= 55 ? 1 : ($roll <= 85 ? 2 : 3);
        }

        return $roll <= 7 ? 1 : ($roll <= 18 ? 2 : ($roll <= 88 ? 3 : 4));
    }

    /** Deck, từ đã biết, thùng rác. */
    private function finishTouches(User $user): void
    {
        $byText = UserWord::ownedBy($user)->get()->keyBy('normalized_text');
        $pick = fn (array $texts) => collect($texts)->map(fn ($t) => $byText[$t]->id ?? null)->filter()->values()->all();

        $ielts = Deck::create(['user_id' => $user->id, 'name' => 'IELTS Academic', 'color' => '#0F6E66']);
        $tech = Deck::create(['user_id' => $user->id, 'name' => 'Công nghệ', 'color' => '#2F5BD3']);
        $attach = fn (Deck $deck, array $ids) => DB::table('deck_words')->insertOrIgnore(
            array_map(fn ($id) => ['deck_id' => $deck->id, 'user_word_id' => $id, 'added_at' => now()->subDays(10)], $ids)
        );
        $attach($ielts, $pick(['ubiquitous', 'mitigate', 'scrutiny', 'nuance', 'pragmatic', 'inevitable', 'ambiguous', 'consensus',
            'deteriorate', 'feasible', 'hinder', 'incentive', 'plausible', 'tangible', 'unprecedented', 'coherent', 'dilemma']));
        $attach($tech, $pick(['leverage', 'lucrative', 'negligible', 'obsolete', 'vulnerable', 'redundant', 'versatile',
            'wary', 'bottleneck', 'paradigm', 'scalable', 'mundane', 'undermine']));

        // Đã biết sẵn
        UserWord::whereIn('id', $pick(['gratitude', 'frugal', 'benevolent']))->update(['status' => UserWord::STATUS_KNOWN]);

        // Thùng rác (xóa vài ngày trước, chưa tới hạn tự xóa hẳn)
        foreach ($pick(['ominous', 'latent', 'candid']) as $i => $id) {
            DB::table('user_words')->where('id', $id)->update(['deleted_at' => now()->subDays(2 + $i)]);
        }
    }
}
