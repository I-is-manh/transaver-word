<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\DictionaryEntry;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/** PATCH /api/words/{id} (contract mục 3.7, v0.16): sửa chữ, ghi chú. */
class WordEditTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123']);
        $this->actingAs($this->user, 'sanctum');
    }

    private function fakeDictionary(): void
    {
        Http::fake([
            'api.dictionaryapi.dev/api/v2/entries/en/tough' => Http::response([[
                'word' => 'tough', 'phonetic' => '/tʌf/',
                'phonetics' => [['audio' => 'https://audio.example/tough.mp3']],
                'meanings' => [['partOfSpeech' => 'adjective', 'definitions' => [['definition' => 'Strong enough to withstand adverse conditions.']]]],
            ]]),
            'api.dictionaryapi.dev/*' => Http::response(['title' => 'No Definitions Found'], 404),
        ]);
    }

    /** Từ "tought" (gõ sai) đã ôn vài lần, có 2 câu (một câu chứa emoji). */
    private function word(string $text = 'tought', array $attrs = []): UserWord
    {
        $old = DictionaryEntry::firstOrCreate(['lang' => 'en', 'normalized_text' => 'thought-old'], ['text' => 'thought', 'found' => true,
            'phonetic' => '/θɔːt/', 'parts_of_speech' => ['noun'], 'definitions' => [['part_of_speech' => 'noun', 'definition' => 'x', 'example' => null]],
            'provider' => 'test', 'fetched_at' => now()]);
        $w = (new UserWord)->forceFill(array_merge([
            'user_id' => $this->user->id, 'dictionary_entry_id' => $old->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => mb_strtolower($text), 'meaning' => 'cứng rắn',
            'fsrs_state' => 2, 'stability' => 12.5, 'difficulty' => 6.1, 'reps' => 7, 'lapses' => 2,
            'due_at' => now()->addDays(5), 'last_review_at' => now()->subDays(7), 'scheduled_days' => 12, 'elapsed_days' => 7,
        ], $attrs));
        $w->save();
        foreach (['She is too tough to quit.', '😀 Times are TOUGH now.', 'Nothing related here.'] as $i => $s) {
            WordContext::create([
                'user_word_id' => $w->id, 'user_id' => $this->user->id, 'sentence' => $s,
                'sentence_hash' => hash('sha256', $s), 'word_offset' => 0, 'word_length' => 3,
            ]);
        }
        DB::table('review_logs')->insert([
            'client_uuid' => (string) Str::uuid(), 'user_id' => $this->user->id, 'user_word_id' => $w->id,
            'exercise_type' => 'flashcard', 'rating' => 3, 'state_before' => 2, 'elapsed_days' => 7, 'scheduled_days' => 12,
            'stability_after' => 12.5, 'difficulty_after' => 6.1, 'due_after' => now()->addDays(5), 'reviewed_at' => now()->subDays(7),
        ]);

        return $w;
    }

    public function test_change_text_keeps_fsrs_and_logs_updates_dictionary_and_offsets(): void
    {
        $this->fakeDictionary();
        $w = $this->word();
        $before = $w->only(['fsrs_state', 'stability', 'difficulty', 'reps', 'lapses', 'scheduled_days', 'elapsed_days']);
        $due = $w->due_at->toIso8601String();

        $this->patchJson("/api/words/{$w->id}", ['text' => '  Tough '])->assertOk()
            ->assertJsonPath('word.text', 'Tough')
            ->assertJsonPath('word.normalized_text', 'tough')
            ->assertJsonPath('word.kind', 'word')
            ->assertJsonPath('word.phonetic', '/tʌf/')
            ->assertJsonPath('word.audio_url', 'https://audio.example/tough.mp3')
            ->assertJsonPath('word.part_of_speech', 'adjective')
            ->assertJsonPath('word.lapses', 2)
            ->assertJsonPath('word.meaning', 'cứng rắn');

        $fresh = $w->fresh();
        $this->assertSame($before, $fresh->only(array_keys($before)));
        $this->assertSame($due, $fresh->due_at->toIso8601String());
        $this->assertSame(1, DB::table('review_logs')->where('user_word_id', $w->id)->count());

        // Vị trí tính lại theo UTF-16: emoji "😀" chiếm 2 đơn vị
        $ctx = WordContext::where('user_word_id', $w->id)->orderBy('id')->get();
        $this->assertSame([11, 5], [$ctx[0]->word_offset, $ctx[0]->word_length]);
        $this->assertSame([13, 5], [$ctx[1]->word_offset, $ctx[1]->word_length]);
        $this->assertSame([null, null], [$ctx[2]->word_offset, $ctx[2]->word_length]);

        // Highlight-list phản ánh chữ mới
        $this->assertSame(['tough'], array_column($this->getJson('/api/words/highlight-list')->json('words'), 'normalized_text'));
    }

    public function test_kind_recomputed_unless_sent(): void
    {
        $this->fakeDictionary();
        $w = $this->word();

        $this->patchJson("/api/words/{$w->id}", ['text' => 'too tough'])->assertOk()
            ->assertJsonPath('word.kind', 'phrase')
            ->assertJsonPath('word.phonetic', null);
        $ctx = WordContext::where('user_word_id', $w->id)->orderBy('id')->first();
        $this->assertSame([7, 9], [$ctx->word_offset, $ctx->word_length]);

        $this->patchJson("/api/words/{$w->id}", ['text' => 'tough guy', 'kind' => 'word'])->assertOk()
            ->assertJsonPath('word.kind', 'word');
    }

    public function test_case_only_change_does_not_conflict_or_touch_offsets(): void
    {
        Http::fake();
        $w = $this->word('ephemeral');

        $this->patchJson("/api/words/{$w->id}", ['text' => 'Ephemeral'])->assertOk()
            ->assertJsonPath('word.text', 'Ephemeral')
            ->assertJsonPath('word.normalized_text', 'ephemeral')
            ->assertJsonPath('word.phonetic', '/θɔːt/'); // giữ entry cũ

        Http::assertNothingSent();
        $this->assertSame(0, WordContext::where('user_word_id', $w->id)->first()->word_offset);
    }

    public function test_duplicate_text_returns_two_different_messages(): void
    {
        Http::fake();
        $w = $this->word();
        $active = $this->word('rough');
        $trashed = $this->word('tough');
        $trashed->delete();
        $otherPair = $this->word('stiff', ['target_lang' => 'fr']);

        $this->patchJson("/api/words/{$w->id}", ['text' => 'ROUGH'])->assertUnprocessable()
            ->assertJsonPath('errors.text.0', 'Bạn đã lưu từ này rồi.');
        $this->patchJson("/api/words/{$w->id}", ['text' => 'tough'])->assertUnprocessable()
            ->assertJsonPath('errors.text.0', 'Từ này đang nằm trong thùng rác. Hãy khôi phục từ đó.');
        $this->assertSame('tought', $w->fresh()->text);
        Http::assertNothingSent();

        // Cùng chữ nhưng khác cặp ngôn ngữ thì không trùng
        Http::fake(['*' => Http::response([], 404)]);
        $this->patchJson("/api/words/{$w->id}", ['text' => 'stiff'])->assertOk();
        $this->assertNotNull($active->fresh());
        $this->assertNotNull($otherPair->fresh());
    }

    public function test_dictionary_error_still_saves_with_null_entry(): void
    {
        Http::fake(fn () => throw new ConnectionException('timeout'));
        $w = $this->word();

        $this->patchJson("/api/words/{$w->id}", ['text' => 'tough'])->assertOk()
            ->assertJsonPath('word.text', 'tough')
            ->assertJsonPath('word.phonetic', null);
        $this->assertNull($w->fresh()->dictionary_entry_id);
    }

    public function test_note_set_clear_and_too_long(): void
    {
        $w = $this->word();

        $this->getJson("/api/words/{$w->id}")->assertJsonPath('word.note', null);
        $this->patchJson("/api/words/{$w->id}", ['note' => 'gặp trong bài báo BBC'])->assertOk()
            ->assertJsonPath('word.note', 'gặp trong bài báo BBC');
        $this->patchJson("/api/words/{$w->id}", ['note' => null])->assertOk()->assertJsonPath('word.note', null);
        $this->patchJson("/api/words/{$w->id}", ['note' => str_repeat('a', 1001)])->assertUnprocessable()
            ->assertJsonValidationErrors(['note']);
    }

    public function test_text_validation_and_trash_404(): void
    {
        $w = $this->word();

        $this->patchJson("/api/words/{$w->id}", ['text' => '   '])->assertUnprocessable()->assertJsonValidationErrors(['text']);
        $this->patchJson("/api/words/{$w->id}", ['text' => str_repeat('a', 101)])->assertUnprocessable()->assertJsonValidationErrors(['text']);

        $w->delete();
        $this->patchJson("/api/words/{$w->id}", ['text' => 'tough'])->assertNotFound();
    }
}
