<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\Deck;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * FIX BE-10: tạo buổi ôn khi review_logs đã có word_context_id từng trả 500
 * (pluck theo MAX(reviewed_at) không alias). Kiểm tra cả việc ưu tiên câu ít dùng gần đây.
 */
class ReviewContextUsageTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-10 03:00:00');
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123']);
        $this->actingAs($this->user, 'sanctum');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Từ đã thuộc kha khá (stability ≥ 7) nên ra bài cloze, có 3 câu. */
    private function wordWithContexts(array $attrs = []): array
    {
        $w = (new UserWord)->forceFill(array_merge([
            'user_id' => $this->user->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => 'ephemeral', 'normalized_text' => 'ephemeral', 'meaning' => 'phù du',
            'fsrs_state' => 2, 'stability' => 12, 'difficulty' => 5, 'reps' => 5, 'lapses' => 3,
            'due_at' => now()->subHour(), 'last_review_at' => now()->subDays(12), 'scheduled_days' => 12,
        ], $attrs));
        $w->save();

        $ctx = [];
        foreach (['Fame is ephemeral.', 'Joy can be ephemeral.', 'An ephemeral trend.'] as $i => $s) {
            $ctx[] = WordContext::create([
                'user_word_id' => $w->id, 'user_id' => $this->user->id,
                'sentence' => $s, 'sentence_hash' => hash('sha256', $s),
                'created_at' => now()->subDays(10 - $i),
            ]);
        }

        return [$w, $ctx];
    }

    private function log(UserWord $w, ?WordContext $ctx, string $at): void
    {
        DB::table('review_logs')->insert([
            'client_uuid' => (string) Str::uuid(), 'user_id' => $this->user->id, 'user_word_id' => $w->id,
            'word_context_id' => $ctx?->id, 'exercise_type' => 'cloze', 'rating' => 3, 'state_before' => 2,
            'elapsed_days' => 1, 'scheduled_days' => 1, 'stability_after' => 12, 'difficulty_after' => 5,
            'due_after' => now(), 'reviewed_at' => Carbon::parse($at),
        ]);
    }

    public function test_sessions_work_when_logs_have_context_and_prefer_least_recently_used(): void
    {
        [$w, [$a, $b, $c]] = $this->wordWithContexts();
        // a dùng gần nhất, c dùng lâu nhất, b dùng ở giữa; thêm một log không có câu
        $this->log($w, $a, '2026-11-09 10:00');
        $this->log($w, $b, '2026-11-05 10:00');
        $this->log($w, $c, '2026-11-01 10:00');
        $this->log($w, $a, '2026-10-01 10:00');
        $this->log($w, null, '2026-11-09 11:00');

        $card = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated()->json('cards.0');
        $this->assertSame('cloze', $card['exercise_type']);
        $this->assertSame($c->id, $card['context']['id'], 'câu dùng lâu nhất được chọn');

        $this->postJson('/api/review/sessions', ['mode' => 'hard'])->assertCreated()->assertJsonPath('cards.0.context.id', $c->id);

        $deck = Deck::create(['user_id' => $this->user->id, 'name' => 'IELTS']);
        $deck->words()->attach($w->id, ['added_at' => now()]);
        $this->postJson('/api/review/sessions', ['mode' => 'deck', 'deck_id' => $deck->id])->assertCreated()
            ->assertJsonPath('cards.0.context.id', $c->id);
    }

    public function test_unused_context_comes_before_used_ones(): void
    {
        [$w, [$a, $b, $c]] = $this->wordWithContexts();
        $this->log($w, $a, '2026-10-01 10:00');
        $this->log($w, $c, '2026-10-02 10:00');

        $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated()
            ->assertJsonPath('cards.0.context.id', $b->id);
    }

    public function test_answer_with_context_then_new_session(): void
    {
        [$w, [$a]] = $this->wordWithContexts();
        $session = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated()->json('session.id');
        $this->postJson('/api/review/answer', [
            'client_uuid' => (string) Str::uuid(), 'session_id' => $session, 'user_word_id' => $w->id,
            'exercise_type' => 'cloze', 'rating' => 1, 'is_correct' => false, 'answer' => 'x', 'word_context_id' => $a->id,
        ])->assertOk();

        // Sau khi quên, từ ở bước học lại 10 phút: buổi mới vẫn tạo được, và không chọn lại câu vừa dùng
        Carbon::setTestNow(now()->addMinutes(11));
        $res = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated();
        $this->assertNotSame($a->id, $res->json('cards.0.context.id'));
    }
}
