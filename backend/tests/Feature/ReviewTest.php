<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\Deck;
use App\Models\ReviewLog;
use App\Models\ReviewSession;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Services\ProgressService;
use App\Services\Review\CardBuilder;
use App\Services\Review\ReviewService;
use App\Support\UserSettings;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** docs/api-contract.md mục 5 */
class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-10 03:00:00'); // 10:00 giờ Việt Nam
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123', 'timezone' => 'Asia/Ho_Chi_Minh']);
        $this->actingAs($this->user, 'sanctum');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function word(string $text, array $attrs = [], ?string $sentence = null, ?User $owner = null): UserWord
    {
        $owner ??= $this->user;
        $word = (new UserWord)->forceFill(array_merge([
            'user_id' => $owner->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => mb_strtolower($text), 'meaning' => "nghĩa {$text}",
        ], $attrs));
        $word->save();
        WordContext::create([
            'user_word_id' => $word->id, 'user_id' => $owner->id,
            'sentence' => $sentence ?? "This is {$text} here.", 'sentence_hash' => hash('sha256', $text.$sentence),
        ]);

        return $word;
    }

    /** Từ đang ôn, đến hạn hôm nay. */
    private function dueWord(string $text, array $attrs = []): UserWord
    {
        return $this->word($text, array_merge([
            'fsrs_state' => 2, 'stability' => 3, 'difficulty' => 5, 'reps' => 3,
            'due_at' => now()->subHour(), 'last_review_at' => now()->subDays(3), 'scheduled_days' => 3,
        ], $attrs));
    }

    private function answer(int $sessionId, int $wordId, int $rating, array $extra = []): TestResponse
    {
        return $this->postJson('/api/review/answer', array_merge([
            'client_uuid' => (string) Str::uuid(),
            'session_id' => $sessionId,
            'user_word_id' => $wordId,
            'exercise_type' => 'flashcard',
            'rating' => $rating,
            'is_correct' => null,
            'answer' => null,
            'word_context_id' => null,
        ], $extra));
    }

    private function startReview(array $body = ['mode' => 'daily']): TestResponse
    {
        return $this->postJson('/api/review/sessions', $body)->assertCreated();
    }

    // ---------- bắt đầu buổi ôn ----------

    public function test_empty_session_still_created(): void
    {
        $this->startReview()
            ->assertJsonPath('cards', [])
            ->assertJsonPath('overload', false)
            ->assertJsonPath('session.mode', 'daily')
            ->assertJsonPath('session.deck_id', null)
            ->assertJsonPath('session.started_at', '2026-11-10T03:00:00Z');
    }

    public function test_daily_session_has_due_words_then_new_words_interleaved(): void
    {
        foreach (range(1, 4) as $i) {
            $this->dueWord("due{$i}", ['due_at' => now()->subHours(5 - $i)]);
        }
        $this->word('new1', ['created_at' => now()->subDays(2)]);
        $this->word('new2', ['created_at' => now()->subDay()]);
        $this->dueWord('notyet', ['due_at' => now()->addDays(3)]);
        $this->dueWord('known', ['status' => 'known']);
        $trashed = $this->dueWord('trashed');
        $trashed->delete();

        $cards = $this->startReview()->json('cards');
        $texts = array_map(fn ($c) => $c['word']['text'], $cards);

        $this->assertCount(6, $cards);
        $this->assertSame(['due1', 'due2', 'due3', 'due4'], array_values(array_filter($texts, fn ($t) => str_starts_with($t, 'due'))));
        $this->assertSame(['new1', 'new2'], array_values(array_filter($texts, fn ($t) => str_starts_with($t, 'new'))));
        $this->assertNotSame('new2', end($texts), 'từ mới không dồn cuối');
        $this->assertNotSame('new1', $texts[0]);

        // Từ mới luôn là flashcard
        $newCard = collect($cards)->firstWhere('word.text', 'new1');
        $this->assertSame('flashcard', $newCard['exercise_type']);
        $this->assertSame($newCard['word']['id'].'-flashcard', $newCard['card_id']);
        $this->assertSame(['1', '2', '3', '4'], array_map('strval', array_keys($newCard['intervals'])));
        $this->assertSame(60, $newCard['intervals']['1']);
        $this->assertSame(600, $newCard['intervals']['3']);
        $this->assertNotNull($newCard['context']);
    }

    public function test_new_words_limited_by_daily_goal_minus_learned_today(): void
    {
        UserSettings::put($this->user, ['daily_new_words' => 3], 'user');
        foreach (range(1, 5) as $i) {
            $this->word("new{$i}", ['created_at' => now()->subMinutes(10 - $i)]);
        }
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-10', 'new_words_learned' => 1]);

        $cards = $this->startReview()->json('cards');
        $this->assertSame(['new1', 'new2'], array_column(array_column($cards, 'word'), 'text'));
    }

    public function test_overload_skips_new_words(): void
    {
        UserSettings::put($this->user, ['daily_review_limit' => 2], 'user');
        foreach (range(1, 3) as $i) {
            $this->dueWord("due{$i}", ['due_at' => now()->subMinutes(10 - $i)]);
        }
        $this->word('new1');

        $res = $this->startReview()->assertJsonPath('overload', true);
        $this->assertSame(['due1', 'due2'], array_column(array_column($res->json('cards'), 'word'), 'text'));
    }

    public function test_due_today_uses_user_timezone(): void
    {
        // 10:00 VN; cuối ngày VN = 16:59:59 UTC
        $this->dueWord('tonight', ['due_at' => Carbon::parse('2026-11-10 16:30:00')]);
        $this->dueWord('tomorrow', ['due_at' => Carbon::parse('2026-11-10 17:30:00')]);

        $texts = array_column(array_column($this->startReview()->json('cards'), 'word'), 'text');
        $this->assertSame(['tonight'], $texts);
    }

    public function test_hard_mode(): void
    {
        $this->dueWord('easy', ['lapses' => 0]);
        $this->dueWord('hard3', ['lapses' => 3, 'due_at' => now()->addDays(10)]);
        $this->dueWord('hard5', ['lapses' => 5]);
        $this->dueWord('hardknown', ['lapses' => 9, 'status' => 'known']);

        $res = $this->startReview(['mode' => 'hard'])->assertJsonPath('session.mode', 'hard');
        $this->assertSame(['hard5', 'hard3'], array_column(array_column($res->json('cards'), 'word'), 'text'));
    }

    public function test_deck_mode(): void
    {
        $in = $this->dueWord('indeck');
        $this->dueWord('outdeck');
        $deck = Deck::create(['user_id' => $this->user->id, 'name' => 'IELTS']);
        $deck->words()->attach($in->id, ['added_at' => now()]);

        $res = $this->startReview(['mode' => 'deck', 'deck_id' => $deck->id])->assertJsonPath('session.deck_id', $deck->id);
        $this->assertSame(['indeck'], array_column(array_column($res->json('cards'), 'word'), 'text'));

        $this->postJson('/api/review/sessions', ['mode' => 'deck'])->assertUnprocessable()->assertJsonValidationErrors(['deck_id']);

        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $otherDeck = Deck::create(['user_id' => $other->id, 'name' => 'X']);
        $this->postJson('/api/review/sessions', ['mode' => 'deck', 'deck_id' => $otherDeck->id])->assertNotFound();
        $this->postJson('/api/review/sessions', ['mode' => 'weird'])->assertUnprocessable();
    }

    // ---------- dạng bài ----------

    public function test_low_stability_gets_mcq_with_three_distractors(): void
    {
        $w = $this->dueWord('ephemeral', ['meaning' => 'phù du']);
        foreach (['bền vững', 'rực rỡ', 'xa xôi'] as $i => $m) {
            $this->word("other{$i}", ['meaning' => $m, 'due_at' => now()->addDays(5), 'fsrs_state' => 2]);
        }

        $card = $this->startReview()->json('cards.0');
        $this->assertSame($w->id, $card['word']['id']);
        $this->assertSame('mcq', $card['exercise_type']);
        $this->assertCount(4, $card['options']);
        $this->assertSame(['a', 'b', 'c', 'd'], array_column($card['options'], 'key'));
        $correct = collect($card['options'])->firstWhere('key', $card['answer_key']);
        $this->assertSame('phù du', $correct['text']);
        $this->assertNull($card['context']);
        $this->assertNull($card['cloze']);
        $this->assertNull($card['answer_text']);
    }

    public function test_mcq_falls_back_to_flashcard_without_enough_distractors(): void
    {
        $this->dueWord('ephemeral');
        $this->word('only1', ['due_at' => now()->addDays(5), 'fsrs_state' => 2]);

        $card = $this->startReview()->json('cards.0');
        $this->assertSame('flashcard', $card['exercise_type']);
        $this->assertNull($card['options']);
    }

    public function test_word_without_meaning_is_flashcard(): void
    {
        $this->dueWord('nomeaning', ['meaning' => null]);
        $this->assertSame('flashcard', $this->startReview()->json('cards.0.exercise_type'));
    }

    public function test_high_stability_gets_cloze_using_utf16_offsets(): void
    {
        // "😀" chiếm 2 đơn vị UTF-16 → word_offset tính theo JavaScript
        $w = $this->dueWord('ephemeral', ['stability' => 10]);
        $sentence = '😀 Fame is Ephemeral, sadly.';
        $ctx = WordContext::create([
            'user_word_id' => $w->id, 'user_id' => $this->user->id, 'sentence' => $sentence,
            'sentence_hash' => hash('sha256', $sentence), 'word_offset' => 11, 'word_length' => 9,
        ]);
        $w->contexts()->where('id', '!=', $ctx->id)->delete();

        $card = $this->startReview()->json('cards.0');
        $this->assertSame('cloze', $card['exercise_type']);
        $this->assertSame(['before' => '😀 Fame is ', 'after' => ', sadly.', 'hint' => null], $card['cloze']);
        $this->assertSame('Ephemeral', $card['answer_text']);
        $this->assertSame($ctx->id, $card['context']['id']);
    }

    public function test_cloze_hint_and_dictation_fallback(): void
    {
        UserSettings::put($this->user, ['exercise_types' => ['flashcard', 'dictation']], 'user');
        $this->dueWord('ephemeral', ['stability' => 10]);

        $card = $this->startReview()->json('cards.0');
        $this->assertSame('dictation', $card['exercise_type']);
        $this->assertSame('ephemeral', $card['answer_text']);

        $cb = app(CardBuilder::class);
        $w = $this->dueWord('ran', ['stability' => 3]);
        $ctx = new WordContext(['sentence' => 'He ran home.']);
        $this->assertSame(['before' => 'He ', 'after' => ' home.', 'answer' => 'ran'], $cb->clozeParts($ctx, $w));
    }

    public function test_disabled_types_fall_back_to_easier_type(): void
    {
        UserSettings::put($this->user, ['exercise_types' => ['flashcard', 'mcq']], 'user');
        $this->dueWord('ephemeral', ['stability' => 30]);
        foreach (range(1, 3) as $i) {
            $this->word("o{$i}", ['due_at' => now()->addDays(5), 'fsrs_state' => 2]);
        }

        $this->assertSame('mcq', $this->startReview()->json('cards.0.exercise_type'));
    }

    // ---------- trả lời ----------

    public function test_answer_updates_fsrs_logs_counts_and_returns_contract_shape(): void
    {
        $w = $this->word('ephemeral');
        $session = $this->startReview()->json('session.id');
        $ctxId = $w->contexts()->first()->id;

        $res = $this->answer($session, $w->id, 3, ['word_context_id' => $ctxId])->assertOk();

        $res->assertJsonStructure([
            'word' => ['id', 'fsrs_state', 'due_at'], 'next_due_at', 'xp_earned', 'became_mastered',
            'today' => ['date', 'reviews_count', 'new_words_learned', 'words_saved', 'xp_earned', 'goal_new_words', 'due_remaining', 'goal_met'],
            'streak' => ['current', 'longest', 'freezes_available', 'last_active_date', 'today_done'],
            'new_achievements',
        ])
            ->assertJsonPath('word.fsrs_state', 1)
            ->assertJsonPath('next_due_at', '2026-11-10T03:10:00Z')
            ->assertJsonPath('xp_earned', 10)
            ->assertJsonPath('became_mastered', false)
            ->assertJsonPath('today.reviews_count', 1)
            ->assertJsonPath('today.new_words_learned', 1)
            ->assertJsonPath('today.date', '2026-11-10')
            ->assertJsonPath('streak.current', 1)
            ->assertJsonPath('streak.today_done', true);

        $log = ReviewLog::firstOrFail();
        $this->assertSame(0, $log->state_before);
        $this->assertSame($ctxId, $log->word_context_id);
        $this->assertSame($session, $log->session_id);
        $this->assertSame(1, $w->fresh()->reps);
        $this->assertSame(10, (int) $this->user->progress()->value('total_xp'));
        $this->assertDatabaseHas('review_sessions', ['id' => $session, 'cards_reviewed' => 1, 'new_cards' => 1, 'correct_count' => 1, 'xp_earned' => 10]);
    }

    public function test_same_client_uuid_is_not_counted_twice(): void
    {
        $w = $this->word('ephemeral');
        $session = $this->startReview()->json('session.id');
        $uuid = (string) Str::uuid();

        $first = $this->answer($session, $w->id, 3, ['client_uuid' => $uuid])->assertOk();
        $second = $this->answer($session, $w->id, 1, ['client_uuid' => $uuid])->assertOk();

        $this->assertSame($first->json('next_due_at'), $second->json('next_due_at'));
        $this->assertSame(10, $second->json('xp_earned'));
        $this->assertSame(1, ReviewLog::count());
        $this->assertSame(1, $w->fresh()->reps);
        $this->assertSame(1, $second->json('today.reviews_count'));
    }

    public function test_xp_by_rating(): void
    {
        $session = $this->startReview()->json('session.id');
        $expected = [1 => 0, 2 => 5, 3 => 10, 4 => 10];
        foreach ($expected as $rating => $xp) {
            $w = $this->dueWord("w{$rating}");
            $this->answer($session, $w->id, $rating)->assertJsonPath('xp_earned', $xp);
        }
        $this->assertSame(25, (int) $this->user->progress()->value('total_xp'));
        $this->assertDatabaseHas('review_sessions', ['id' => $session, 'correct_count' => 3, 'cards_reviewed' => 4]);
    }

    public function test_became_mastered_gives_bonus_once(): void
    {
        $w = $this->dueWord('ephemeral', ['stability' => 15, 'last_review_at' => now()->subDays(15), 'scheduled_days' => 15]);
        $session = $this->startReview()->json('session.id');

        $this->answer($session, $w->id, 3)->assertJsonPath('became_mastered', true)->assertJsonPath('xp_earned', 60);
        $this->assertNotNull($w->fresh()->first_mastered_at);

        // Quên rồi thuộc lại: không thưởng lần hai
        $w->refresh();
        $w->forceFill(['stability' => 15, 'fsrs_state' => 2, 'due_at' => now()])->save();
        $this->answer($session, $w->id, 3)->assertJsonPath('became_mastered', false)->assertJsonPath('xp_earned', 10);
    }

    public function test_answer_validation_and_ownership(): void
    {
        $w = $this->word('ephemeral');
        $session = $this->startReview()->json('session.id');
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $otherWord = $this->word('secret', [], null, $other);
        $otherSession = ReviewSession::create(['user_id' => $other->id, 'mode' => 'daily', 'started_at' => now()]);

        $this->postJson('/api/review/answer', ['rating' => 5, 'client_uuid' => 'x'])->assertUnprocessable()
            ->assertJsonValidationErrors(['rating', 'client_uuid', 'session_id', 'user_word_id', 'exercise_type']);
        $this->answer($session, $otherWord->id, 3)->assertNotFound();
        $this->answer($otherSession->id, $w->id, 3)->assertNotFound();
        $this->answer($session, $w->id, 3, ['word_context_id' => $otherWord->contexts()->first()->id])
            ->assertUnprocessable()->assertJsonValidationErrors(['word_context_id']);

        $w->delete();
        $this->answer($session, $w->id, 3)->assertNotFound();
        $this->assertSame(0, ReviewLog::count());
    }

    // ---------- kết thúc ----------

    public function test_finish_is_idempotent_and_summarises(): void
    {
        $a = $this->word('a');
        $b = $this->dueWord('b');
        $session = $this->startReview()->json('session.id');
        $this->answer($session, $a->id, 3);
        $this->answer($session, $b->id, 1);

        Carbon::setTestNow(now()->addMinutes(7));
        $first = $this->postJson("/api/review/sessions/{$session}/finish")->assertOk()
            ->assertJsonPath('summary', [
                'cards_reviewed' => 2, 'correct_count' => 1, 'new_cards' => 1,
                'xp_earned' => 10, 'duration_seconds' => 420, 'newly_mastered' => 0,
            ])
            ->assertJsonPath('xp.total', 10)
            ->assertJsonPath('xp.level', 1)
            ->assertJsonStructure(['today', 'streak', 'xp' => ['total', 'level', 'level_progress', 'xp_to_next_level']]);

        Carbon::setTestNow(now()->addMinutes(30));
        $this->postJson("/api/review/sessions/{$session}/finish")->assertOk()
            ->assertJsonPath('summary', $first->json('summary'));

        $this->assertSame(420, (int) DB::table('daily_activity')->value('study_seconds'));

        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $otherSession = ReviewSession::create(['user_id' => $other->id, 'mode' => 'daily', 'started_at' => now()]);
        $this->postJson("/api/review/sessions/{$otherSession->id}/finish")->assertNotFound();
    }

    // ---------- streak ----------

    private function studyOn(string $localDate): void
    {
        Carbon::setTestNow(Carbon::parse("{$localDate} 10:00", 'Asia/Ho_Chi_Minh')->utc());
        $w = $this->dueWord('s'.Str::random(6));
        $session = ReviewSession::create(['user_id' => $this->user->id, 'mode' => 'daily', 'started_at' => now()]);
        $this->answer($session->id, $w->id, 3)->assertOk();
    }

    private function streakOn(string $localDate): array
    {
        Carbon::setTestNow(Carbon::parse("{$localDate} 10:00", 'Asia/Ho_Chi_Minh')->utc());

        return app(ProgressService::class)->streak($this->user->fresh());
    }

    public function test_streak_counts_consecutive_days_and_earns_freeze_every_7(): void
    {
        foreach (range(1, 7) as $d) {
            $this->studyOn(sprintf('2026-11-%02d', $d));
        }
        $s = $this->streakOn('2026-11-07');
        $this->assertSame(7, $s['current']);
        $this->assertSame(1, $s['freezes_available']);
        $this->assertTrue($s['today_done']);

        // Hai lượt ôn trong cùng ngày không cộng thêm
        $this->studyOn('2026-11-07');
        $this->assertSame(7, $this->streakOn('2026-11-07')['current']);

        $this->assertFalse($this->streakOn('2026-11-08')['today_done']);
    }

    public function test_missed_day_uses_freeze_then_resets_without_freezes(): void
    {
        foreach (range(1, 7) as $d) {
            $this->studyOn(sprintf('2026-11-%02d', $d));
        }
        // Bỏ ngày 8, học ngày 9: dùng 1 thẻ, streak tiếp tục
        $this->studyOn('2026-11-09');
        $s = $this->streakOn('2026-11-09');
        $this->assertSame(8, $s['current']);
        $this->assertSame(0, $s['freezes_available']);
        $this->assertDatabaseHas('daily_activity', ['user_id' => $this->user->id, 'activity_date' => '2026-11-08', 'freeze_used' => true]);

        // Đọc streak nhiều lần không trừ thêm thẻ
        $this->streakOn('2026-11-09');

        // Bỏ ngày 10, 11 (hết thẻ) → về 0, longest giữ 8
        $s = $this->streakOn('2026-11-12');
        $this->assertSame(0, $s['current']);
        $this->assertSame(8, $s['longest']);

        $this->studyOn('2026-11-12');
        $this->assertSame(1, $this->streakOn('2026-11-12')['current']);
    }

    public function test_freezes_capped_at_max(): void
    {
        foreach (range(1, 21) as $d) {
            $this->studyOn(Carbon::parse('2026-11-01')->addDays($d - 1)->toDateString());
        }
        $s = $this->streakOn('2026-11-21');
        $this->assertSame(21, $s['current']);
        $this->assertSame(2, $s['freezes_available']);
    }

    public function test_study_day_follows_user_timezone(): void
    {
        // 23:30 giờ VN ngày 10 = 16:30 UTC; 00:30 VN ngày 11 = 17:30 UTC → hai ngày khác nhau
        Carbon::setTestNow('2026-11-10 16:30:00');
        $session = ReviewSession::create(['user_id' => $this->user->id, 'mode' => 'daily', 'started_at' => now()]);
        $this->answer($session->id, $this->dueWord('a')->id, 3)->assertJsonPath('today.date', '2026-11-10');
        Carbon::setTestNow('2026-11-10 17:30:00');
        $this->answer($session->id, $this->dueWord('b')->id, 3)
            ->assertJsonPath('today.date', '2026-11-11')
            ->assertJsonPath('streak.current', 2);
    }

    // ---------- tiện ích ----------

    public function test_xp_levels(): void
    {
        $this->assertSame(['total' => 0, 'level' => 1, 'level_progress' => 0.0, 'xp_to_next_level' => 100], ProgressService::xpFor(0));
        $this->assertSame(2, ProgressService::xpFor(100)['level']);
        $this->assertSame(['total' => 350, 'level' => 3, 'level_progress' => 0.1667, 'xp_to_next_level' => 250], ProgressService::xpFor(350));
    }

    public function test_interleave_spreads_new_words(): void
    {
        $r = new Collection(array_map(fn ($i) => "r{$i}", range(1, 6)));
        $n = new Collection(['n1', 'n2']);
        $this->assertSame(['r1', 'r2', 'n1', 'r3', 'r4', 'n2', 'r5', 'r6'], ReviewService::interleave($r, $n)->all());
    }

    public function test_goal_met_after_all_due_and_new_done(): void
    {
        UserSettings::put($this->user, ['daily_new_words' => 1], 'user');
        $d = $this->dueWord('due');
        $n = $this->word('new');
        $session = $this->startReview()->json('session.id');

        $this->answer($session, $d->id, 3)->assertJsonPath('today.goal_met', false);
        $res = $this->answer($session, $n->id, 4)->assertOk(); // Dễ → tốt nghiệp ngay, không còn đến hạn hôm nay
        $res->assertJsonPath('today.due_remaining', 0)->assertJsonPath('today.goal_met', true);
        $this->assertTrue((bool) DB::table('daily_activity')->value('goal_met'));
    }
}
