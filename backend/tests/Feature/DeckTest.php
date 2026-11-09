<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\Deck;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Support\UserSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** docs/api-contract.md mục 7, cùng phần giai đoạn 5 ở mục 3 và 5 */
class DeckTest extends TestCase
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

    private function word(string $text, array $attrs = [], ?User $owner = null): UserWord
    {
        $owner ??= $this->user;
        $w = (new UserWord)->forceFill(array_merge([
            'user_id' => $owner->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => $text, 'meaning' => "nghĩa {$text}",
        ], $attrs));
        $w->save();
        WordContext::create(['user_word_id' => $w->id, 'user_id' => $owner->id, 'sentence' => "A {$text} b.", 'sentence_hash' => hash('sha256', $text)]);

        return $w;
    }

    public function test_deck_crud(): void
    {
        $id = $this->postJson('/api/decks', ['name' => '  IELTS  ', 'color' => '#0f6e66'])->assertCreated()
            ->assertJsonPath('deck.name', 'IELTS')
            ->assertJsonPath('deck.color', '#0F6E66')
            ->assertJsonPath('deck.words_count', 0)
            ->assertJsonPath('deck.due_count', 0)
            ->assertJsonPath('deck.created_at', '2026-11-10T03:00:00Z')
            ->json('deck.id');

        $this->postJson('/api/decks', ['name' => 'Bóng đá'])->assertCreated()->assertJsonPath('deck.color', null);
        $this->postJson('/api/decks', ['name' => 'Ielts'])->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Bạn đã có deck tên này.');
        $this->postJson('/api/decks', ['name' => '', 'color' => 'red'])->assertUnprocessable()->assertJsonValidationErrors(['name', 'color']);

        $this->getJson('/api/decks')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Bóng đá')
            ->assertJsonPath('data.1.name', 'IELTS');

        $this->patchJson("/api/decks/{$id}", ['name' => 'IELTS 7.0', 'color' => null])->assertOk()
            ->assertJsonPath('deck.name', 'IELTS 7.0')->assertJsonPath('deck.color', null);
        $this->patchJson("/api/decks/{$id}", ['name' => 'IELTS 7.0'])->assertOk(); // giữ tên cũ không báo trùng

        $this->deleteJson("/api/decks/{$id}")->assertNoContent();
        $this->getJson('/api/decks')->assertJsonCount(1, 'data');
    }

    public function test_add_and_remove_words_keeps_words_when_deck_deleted(): void
    {
        $deck = Deck::create(['user_id' => $this->user->id, 'name' => 'IELTS']);
        $a = $this->word('a', ['fsrs_state' => 2, 'stability' => 3, 'due_at' => now()->subHour()]);
        $b = $this->word('b');
        $c = $this->word('c');

        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => [$a->id, $b->id]])->assertOk()
            ->assertJsonPath('deck.words_count', 2)
            ->assertJsonPath('deck.due_count', 1);
        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => [$a->id, $c->id]])->assertOk()
            ->assertJsonPath('deck.words_count', 3); // đã có thì bỏ qua

        $this->getJson("/api/words/{$a->id}")->assertJsonPath('word.deck_ids', [$deck->id]);
        $this->getJson("/api/words?deck_id={$deck->id}")->assertJsonPath('meta.total', 3);

        $this->deleteJson("/api/decks/{$deck->id}/words", ['word_ids' => [$b->id]])->assertOk()
            ->assertJsonPath('deck.words_count', 2);

        $c->delete(); // từ trong thùng rác không tính
        $this->getJson('/api/decks')->assertJsonPath('data.0.words_count', 1);

        $this->deleteJson("/api/decks/{$deck->id}")->assertNoContent();
        $this->assertNotNull(UserWord::find($a->id));
        $this->getJson("/api/words/{$a->id}")->assertJsonPath('word.deck_ids', []);
    }

    public function test_cannot_add_other_users_or_trashed_words(): void
    {
        $deck = Deck::create(['user_id' => $this->user->id, 'name' => 'IELTS']);
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $theirs = $this->word('theirs', [], $other);
        $trashed = $this->word('trash');
        $trashed->delete();

        $errors = $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => [$theirs->id]])->assertUnprocessable()->json('errors');
        $this->assertSame('Có từ không tồn tại trong kho của bạn.', $errors['word_ids.0'][0]);
        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => [$trashed->id]])->assertUnprocessable();
        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => range(1, 201)])->assertUnprocessable()->assertJsonValidationErrors(['word_ids']);
        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => []])->assertUnprocessable();
    }

    public function test_other_users_deck_is_404(): void
    {
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $deck = Deck::create(['user_id' => $other->id, 'name' => 'Secret']);
        $mine = $this->word('a');

        $this->patchJson("/api/decks/{$deck->id}", ['name' => 'x'])->assertNotFound();
        $this->deleteJson("/api/decks/{$deck->id}")->assertNotFound();
        $this->postJson("/api/decks/{$deck->id}/words", ['word_ids' => [$mine->id]])->assertNotFound();
        $this->deleteJson("/api/decks/{$deck->id}/words", ['word_ids' => [$mine->id]])->assertNotFound();
        $this->getJson("/api/words?deck_id={$deck->id}")->assertNotFound();
        $this->getJson('/api/decks')->assertJsonCount(0, 'data');

        // Tên trùng với deck của người khác vẫn được
        $this->postJson('/api/decks', ['name' => 'Secret'])->assertCreated();
    }

    public function test_words_hard_filter(): void
    {
        $this->word('easy', ['lapses' => 1]);
        $this->word('hard', ['lapses' => 3]);
        $this->word('hardknown', ['lapses' => 5, 'status' => 'known']);

        $res = $this->getJson('/api/words?hard=1')->assertOk()->assertJsonPath('meta.total', 1);
        $this->assertSame('hard', $res->json('data.0.text'));
        $this->getJson('/api/words?hard=0')->assertJsonPath('meta.total', 3);
    }

    public function test_listening_card_for_low_stability_when_only_listening_enabled(): void
    {
        UserSettings::put($this->user, ['exercise_types' => ['flashcard', 'listening']], 'user');
        $this->word('target', ['fsrs_state' => 2, 'stability' => 3, 'due_at' => now()->subHour()]);
        foreach (range(1, 3) as $i) {
            $this->word("o{$i}", ['fsrs_state' => 2, 'due_at' => now()->addDays(9)]);
        }

        $card = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated()->json('cards.0');
        $this->assertSame('listening', $card['exercise_type']);
        $this->assertCount(4, $card['options']);
        $this->assertNotNull($card['answer_key']);
        $this->assertNull($card['context']);
    }

    public function test_desired_retention_changes_intervals(): void
    {
        $w = $this->word('target', ['fsrs_state' => 2, 'stability' => 10, 'difficulty' => 5, 'reps' => 4,
            'due_at' => now()->subHour(), 'last_review_at' => now()->subDays(10), 'scheduled_days' => 10]);

        $low = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->json('cards.0.intervals.3');
        $this->patchJson('/api/settings', ['desired_retention' => 0.95])->assertOk();
        $high = $this->postJson('/api/review/sessions', ['mode' => 'daily'])->json('cards.0.intervals.3');

        $this->assertGreaterThan($high, $low);
        $this->assertSame($w->id, $this->postJson('/api/review/sessions', ['mode' => 'daily'])->json('cards.0.word.id'));
    }
}
