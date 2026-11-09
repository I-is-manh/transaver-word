<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\DictionaryEntry;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** docs/api-contract.md mục 3 và 4 */
class WordsTest extends TestCase
{
    use RefreshDatabase;

    private const DICT_URL = 'api.dictionaryapi.dev/api/v2/entries/en/*';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123', 'timezone' => 'Asia/Ho_Chi_Minh']);
        $this->actingAs($this->user, 'sanctum');
    }

    private function fakeDictionary(): void
    {
        Http::fake([
            'api.dictionaryapi.dev/api/v2/entries/en/ephemeral' => Http::response([[
                'word' => 'ephemeral',
                'phonetic' => '/ɪˈfem(ə)rəl/',
                'phonetics' => [['text' => '/ɪˈfem(ə)rəl/', 'audio' => ''], ['audio' => 'https://audio.example/ephemeral.mp3']],
                'meanings' => [
                    ['partOfSpeech' => 'adjective', 'definitions' => [
                        ['definition' => 'Lasting for a very short time.', 'example' => 'fashions are ephemeral'],
                        ['definition' => 'Lasting one day only.'],
                    ]],
                    ['partOfSpeech' => 'noun', 'definitions' => [['definition' => 'An ephemeral plant.']]],
                ],
            ]]),
            self::DICT_URL => Http::response(['title' => 'No Definitions Found'], 404),
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'text' => 'Ephemeral',
            'source_lang' => 'en',
            'target_lang' => 'vi',
            'sentence' => 'Fame in the age of social media is ephemeral.',
            'word_offset' => 35,
            'word_length' => 9,
            'page_title' => 'The Attention Economy',
            'page_url' => 'https://example.com/article',
        ], $overrides);
    }

    private function makeWord(string $text, array $attrs = [], ?User $owner = null): UserWord
    {
        $owner ??= $this->user;
        $word = (new UserWord)->forceFill(array_merge([
            'user_id' => $owner->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => mb_strtolower($text),
        ], $attrs));
        $word->save();
        WordContext::create([
            'user_word_id' => $word->id, 'user_id' => $owner->id,
            'sentence' => "A sentence with {$text}.", 'sentence_hash' => hash('sha256', $text),
        ]);

        return $word;
    }

    // ---------- POST /api/words ----------

    public function test_save_new_word_returns_201_with_dictionary_data(): void
    {
        $this->fakeDictionary();

        $res = $this->postJson('/api/words', $this->payload(['translation' => 'phù du']))->assertCreated();

        $res->assertJsonPath('word_created', true)
            ->assertJsonPath('context_created', true)
            ->assertJsonPath('word.text', 'Ephemeral')
            ->assertJsonPath('word.normalized_text', 'ephemeral')
            ->assertJsonPath('word.kind', 'word')
            ->assertJsonPath('word.meaning', 'phù du')
            ->assertJsonPath('word.phonetic', '/ɪˈfem(ə)rəl/')
            ->assertJsonPath('word.audio_url', 'https://audio.example/ephemeral.mp3')
            ->assertJsonPath('word.part_of_speech', 'adjective')
            ->assertJsonPath('word.status', 'learning')
            ->assertJsonPath('word.fsrs_state', 0)
            ->assertJsonPath('word.due_at', null)
            ->assertJsonPath('word.is_mastered', false)
            ->assertJsonPath('word.contexts_count', 1)
            ->assertJsonPath('word.deleted_at', null)
            ->assertJsonPath('context.word_offset', 35)
            ->assertJsonPath('context.word_length', 9)
            ->assertJsonPath('context.meaning', 'phù du')
            ->assertJsonPath('context.meaning_source', 'translation')
            ->assertJsonPath('context.page_url', 'https://example.com/article');

        // Bản dịch đứng đầu, sau đó nghĩa từ điển theo thứ tự
        $res->assertJsonPath('meaning_candidates.0', [
            'key' => 'translation', 'source' => 'translation', 'part_of_speech' => null, 'text' => 'phù du', 'example' => null,
        ]);
        $res->assertJsonPath('meaning_candidates.1.source', 'dictionary')
            ->assertJsonPath('meaning_candidates.1.part_of_speech', 'adjective')
            ->assertJsonPath('meaning_candidates.1.text', 'Lasting for a very short time.')
            ->assertJsonPath('meaning_candidates.1.example', 'fashions are ephemeral')
            ->assertJsonCount(4, 'meaning_candidates');

        $this->assertDatabaseHas('daily_activity', [
            'user_id' => $this->user->id,
            'activity_date' => Carbon::now('Asia/Ho_Chi_Minh')->toDateString(),
            'words_saved' => 1,
        ]);
    }

    public function test_saving_same_word_and_sentence_again_returns_200_without_duplicates(): void
    {
        $this->fakeDictionary();
        $first = $this->postJson('/api/words', $this->payload())->assertCreated();

        $this->postJson('/api/words', $this->payload(['text' => '  EPHEMERAL ', 'sentence' => 'fame in the age of  social media is ephemeral.']))
            ->assertOk()
            ->assertJsonPath('word_created', false)
            ->assertJsonPath('context_created', false)
            ->assertJsonPath('word.id', $first->json('word.id'))
            ->assertJsonPath('context.id', $first->json('context.id'));

        $this->assertSame(1, UserWord::count());
        $this->assertSame(1, WordContext::count());
        $this->assertSame(1, DB::table('daily_activity')->value('words_saved'));
        Http::assertSentCount(1); // lần 2 dùng cache dictionary_entries
    }

    public function test_same_word_new_sentence_adds_context(): void
    {
        $this->fakeDictionary();
        $this->postJson('/api/words', $this->payload())->assertCreated();

        $this->postJson('/api/words', $this->payload(['sentence' => 'Their happiness was ephemeral.']))
            ->assertOk()
            ->assertJsonPath('word_created', false)
            ->assertJsonPath('context_created', true)
            ->assertJsonPath('word.contexts_count', 2);
    }

    public function test_saving_word_in_trash_restores_it(): void
    {
        $this->fakeDictionary();
        $id = $this->postJson('/api/words', $this->payload())->json('word.id');
        $this->deleteJson("/api/words/{$id}")->assertNoContent();

        $this->postJson('/api/words', $this->payload(['sentence' => 'Ephemeral joy.']))
            ->assertOk()
            ->assertJsonPath('word_created', false)
            ->assertJsonPath('word.id', $id)
            ->assertJsonPath('word.deleted_at', null)
            ->assertJsonPath('word.contexts_count', 2);

        $this->assertSame(1, UserWord::withTrashed()->count());
        $this->assertSame(1, DB::table('daily_activity')->value('words_saved'));
    }

    public function test_translation_does_not_overwrite_word_meaning_but_new_context_keeps_it(): void
    {
        $this->fakeDictionary();
        $this->postJson('/api/words', $this->payload(['translation' => 'phù du']))->assertCreated();

        // Câu mới: giữ nghĩa riêng là bản dịch; nghĩa chính của từ không đổi
        $this->postJson('/api/words', $this->payload(['sentence' => 'Ephemeral joy.', 'translation' => 'ngắn ngủi']))
            ->assertOk()
            ->assertJsonPath('word.meaning', 'phù du')
            ->assertJsonPath('context.meaning', 'ngắn ngủi')
            ->assertJsonPath('context.meaning_source', 'translation')
            ->assertJsonPath('meaning_candidates.0.text', 'ngắn ngủi');

        // Câu đã có: không bị ghi đè
        $this->postJson('/api/words', $this->payload(['translation' => 'thoáng qua']))
            ->assertOk()
            ->assertJsonPath('context_created', false)
            ->assertJsonPath('context.meaning', 'phù du');
    }

    public function test_context_without_translation_has_null_meaning(): void
    {
        $this->fakeDictionary();
        $this->postJson('/api/words', $this->payload())->assertCreated()
            ->assertJsonPath('word.meaning', null)
            ->assertJsonPath('context.meaning', null)
            ->assertJsonPath('context.meaning_source', null);
    }

    public function test_text_with_space_is_saved_as_phrase(): void
    {
        Http::fake([self::DICT_URL => Http::response([], 404)]);

        $this->postJson('/api/words', $this->payload(['text' => 'Give   up', 'sentence' => 'Never give up on your dreams.']))
            ->assertCreated()
            ->assertJsonPath('word.text', 'Give up')
            ->assertJsonPath('word.normalized_text', 'give up')
            ->assertJsonPath('word.kind', 'phrase');
    }

    public function test_dictionary_not_found_is_cached(): void
    {
        Http::fake([self::DICT_URL => Http::response(['title' => 'No Definitions Found'], 404)]);

        $this->postJson('/api/words', $this->payload(['text' => 'xyzzy', 'sentence' => 'A xyzzy here.']))
            ->assertCreated()
            ->assertJsonPath('word.phonetic', null)
            ->assertJsonPath('meaning_candidates', []);

        $this->assertDatabaseHas('dictionary_entries', ['normalized_text' => 'xyzzy', 'found' => false]);

        $this->getJson('/api/dictionary/lookup?text=xyzzy&lang=en')->assertOk()->assertExactJson(['entry' => null]);
        Http::assertSentCount(1);
    }

    public function test_dictionary_timeout_still_saves_word_and_is_not_cached(): void
    {
        Http::fake(fn () => throw new ConnectionException('Operation timed out after 3000 ms'));

        $this->postJson('/api/words', $this->payload())
            ->assertCreated()
            ->assertJsonPath('word.phonetic', null);

        $this->assertSame(0, DictionaryEntry::count());
    }

    public function test_dictionary_server_error_still_saves_word(): void
    {
        Http::fake([self::DICT_URL => Http::response('oops', 500)]);

        $this->postJson('/api/words', $this->payload())->assertCreated();
        $this->assertSame(0, DictionaryEntry::count());
    }

    public function test_non_english_source_does_not_call_dictionary(): void
    {
        $this->postJson('/api/words', $this->payload(['text' => 'ありがとう', 'source_lang' => 'ja', 'sentence' => 'ありがとうございます。']))
            ->assertCreated()
            ->assertJsonPath('word.normalized_text', 'ありがとう');

        Http::assertNothingSent();
    }

    public function test_page_url_not_saved_when_user_disables_it(): void
    {
        Http::fake([self::DICT_URL => Http::response([], 404)]);
        $settings = $this->user->settings;
        $settings->settings = array_merge($settings->settings, ['save_page_url' => ['value' => false, 'source' => 'user']]);
        $settings->save();

        $this->postJson('/api/words', $this->payload())->assertCreated()
            ->assertJsonPath('context.page_url', null)
            ->assertJsonPath('context.page_title', null);
    }

    public function test_store_validation(): void
    {
        $this->postJson('/api/words', ['text' => str_repeat('a', 101), 'sentence' => str_repeat('b', 501), 'source_lang' => 'e', 'page_url' => 'ftp://x.y'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['text', 'sentence', 'source_lang', 'target_lang', 'page_url']);
    }

    public function test_words_are_isolated_between_users(): void
    {
        Http::fake([self::DICT_URL => Http::response([], 404)]);
        $other = app(CreateUser::class)->handle(['email' => 'other@example.com', 'password' => 'password123']);
        $this->makeWord('ephemeral', [], $other);

        // Cùng từ nhưng người khác: tạo mới cho mình
        $this->postJson('/api/words', $this->payload())->assertCreated()->assertJsonPath('word_created', true);
    }

    // ---------- GET /api/words ----------

    public function test_list_search_filter_sort_and_paginate(): void
    {
        $this->makeWord('apple', ['meaning' => 'quả táo', 'created_at' => now()->subDays(3)]);
        $this->makeWord('banana', ['meaning' => 'quả chuối', 'status' => 'known', 'created_at' => now()->subDays(2)]);
        $this->makeWord('give up', ['kind' => 'phrase', 'meaning' => 'từ bỏ', 'created_at' => now()->subDay()]);
        $trashed = $this->makeWord('cherry', ['meaning' => 'anh đào']);
        $trashed->delete();

        // Mặc định: mới nhất trước, không có từ trong thùng rác
        $this->getJson('/api/words')->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.text', 'give up')
            ->assertJsonStructure(['data', 'links', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $this->getJson('/api/words?q=QUẢ')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/words?q=APP')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.text', 'apple');
        $this->getJson('/api/words?q=50%25')->assertOk()->assertJsonPath('meta.total', 0); // % không phải ký tự đại diện
        $this->getJson('/api/words?status=known')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.text', 'banana');
        $this->getJson('/api/words?kind=phrase')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/words?sort=text')->assertOk()->assertJsonPath('data.0.text', 'apple')->assertJsonPath('data.2.text', 'give up');
        $this->getJson('/api/words?sort=created_at')->assertOk()->assertJsonPath('data.0.text', 'apple');
        $this->getJson('/api/words?per_page=2&page=2')->assertOk()
            ->assertJsonPath('meta.per_page', 2)->assertJsonPath('meta.current_page', 2)->assertJsonCount(1, 'data');
        $this->getJson('/api/words?per_page=101&sort=abc&status=x')->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page', 'sort', 'status']);
    }

    public function test_sort_by_due_at_puts_null_last(): void
    {
        $this->makeWord('later', ['due_at' => now()->addDays(5)]);
        $this->makeWord('new');
        $this->makeWord('soon', ['due_at' => now()->addDay()]);

        $this->getJson('/api/words?sort=due_at')->assertOk()
            ->assertJsonPath('data.0.text', 'soon')
            ->assertJsonPath('data.1.text', 'later')
            ->assertJsonPath('data.2.text', 'new');
    }

    // ---------- show / update ----------

    public function test_show_returns_word_with_contexts_newest_first(): void
    {
        $word = $this->makeWord('ephemeral');
        $newer = WordContext::create([
            'user_word_id' => $word->id, 'user_id' => $this->user->id,
            'sentence' => 'Newer sentence ephemeral.', 'sentence_hash' => hash('sha256', 'newer'),
            'created_at' => now()->addMinute(),
        ]);

        $this->getJson("/api/words/{$word->id}")->assertOk()
            ->assertJsonPath('word.id', $word->id)
            ->assertJsonPath('word.contexts_count', 2)
            ->assertJsonCount(2, 'contexts')
            ->assertJsonPath('contexts.0.id', $newer->id);
    }

    public function test_update_meaning_status_kind(): void
    {
        $word = $this->makeWord('ephemeral', ['meaning' => 'cũ']);

        $this->patchJson("/api/words/{$word->id}", ['meaning' => 'phù du, chóng tàn', 'status' => 'known'])
            ->assertOk()
            ->assertJsonPath('word.meaning', 'phù du, chóng tàn')
            ->assertJsonPath('word.status', 'known');

        $this->patchJson("/api/words/{$word->id}", ['meaning' => null, 'status' => 'learning', 'kind' => 'phrase'])
            ->assertOk()
            ->assertJsonPath('word.meaning', null)
            ->assertJsonPath('word.status', 'learning')
            ->assertJsonPath('word.kind', 'phrase');

        $this->patchJson("/api/words/{$word->id}", ['status' => 'deleted', 'meaning' => str_repeat('x', 501)])
            ->assertUnprocessable()->assertJsonValidationErrors(['status', 'meaning']);
    }

    public function test_is_mastered_uses_config_threshold(): void
    {
        $word = $this->makeWord('ephemeral');
        DB::table('user_words')->where('id', $word->id)->update(['fsrs_state' => 2, 'stability' => 25]);

        $this->getJson("/api/words/{$word->id}")->assertOk()->assertJsonPath('word.is_mastered', true);
    }

    // ---------- thùng rác ----------

    public function test_trash_full_flow(): void
    {
        $word = $this->makeWord('ephemeral');
        $kept = $this->makeWord('apple');

        // Xóa hẳn khi chưa ở thùng rác → 409
        $this->deleteJson("/api/words/{$word->id}/force")->assertStatus(409)
            ->assertJsonPath('message', 'Chỉ xóa hẳn được từ đang nằm trong thùng rác.');

        $this->deleteJson("/api/words/{$word->id}")->assertNoContent();
        $this->deleteJson("/api/words/{$word->id}")->assertNoContent(); // gọi lại vẫn 204

        $this->getJson('/api/words')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/words/trash')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $word->id);
        $this->assertNotNull($this->getJson('/api/words/trash')->json('data.0.deleted_at'));

        // Từ trong thùng rác vẫn xem được, nhưng không sửa được
        $this->getJson("/api/words/{$word->id}")->assertOk();
        $this->patchJson("/api/words/{$word->id}", ['meaning' => 'x'])->assertNotFound();

        $this->postJson("/api/words/{$word->id}/restore")->assertOk()->assertJsonPath('word.deleted_at', null);
        $this->getJson('/api/words/trash')->assertJsonPath('meta.total', 0);

        $this->deleteJson("/api/words/{$word->id}")->assertNoContent();
        $this->deleteJson("/api/words/{$word->id}/force")->assertNoContent();

        $this->assertNull(UserWord::withTrashed()->find($word->id));
        $this->assertSame(0, WordContext::where('user_word_id', $word->id)->count());
        $this->assertNotNull(UserWord::find($kept->id));
    }

    public function test_trash_newest_deleted_first_and_search(): void
    {
        $a = $this->makeWord('apple');
        $b = $this->makeWord('banana');
        Carbon::setTestNow(now()->subHour());
        $a->delete();
        Carbon::setTestNow();
        $b->delete();

        $this->getJson('/api/words/trash')->assertJsonPath('data.0.id', $b->id)->assertJsonPath('data.1.id', $a->id);
        $this->getJson('/api/words/trash?q=app')->assertJsonPath('meta.total', 1);
    }

    public function test_purge_command_deletes_words_trashed_longer_than_trash_days(): void
    {
        $old = $this->makeWord('old');
        $recent = $this->makeWord('recent');
        $active = $this->makeWord('active');

        Carbon::setTestNow(now()->subDays(31));
        $old->delete();
        Carbon::setTestNow();
        $recent->delete();

        $this->artisan('words:purge-trash')->assertSuccessful();

        $this->assertNull(UserWord::withTrashed()->find($old->id));
        $this->assertNotNull(UserWord::withTrashed()->find($recent->id));
        $this->assertNotNull(UserWord::find($active->id));
    }

    // ---------- phân quyền ----------

    public function test_other_users_word_is_404_everywhere(): void
    {
        $other = app(CreateUser::class)->handle(['email' => 'other@example.com', 'password' => 'password123']);
        $word = $this->makeWord('secret', [], $other);
        $ctx = $word->contexts()->first();

        $this->getJson("/api/words/{$word->id}")->assertNotFound()->assertExactJson(['message' => 'Không tìm thấy.']);
        $this->patchJson("/api/words/{$word->id}", ['meaning' => 'x'])->assertNotFound();
        $this->deleteJson("/api/words/{$word->id}")->assertNotFound();
        $this->postJson("/api/words/{$word->id}/restore")->assertNotFound();
        $this->deleteJson("/api/words/{$word->id}/force")->assertNotFound();
        $this->getJson("/api/words/{$word->id}/meaning-candidates")->assertNotFound();
        $this->patchJson("/api/words/{$word->id}/contexts/{$ctx->id}", ['meaning' => 'x', 'meaning_source' => 'user'])->assertNotFound();
        $this->deleteJson("/api/words/{$word->id}/contexts/{$ctx->id}")->assertNotFound();
        $this->getJson('/api/words/999999')->assertNotFound();

        $this->assertSame('x', 'x');
        $this->assertNotNull(UserWord::find($word->id));
    }

    public function test_context_of_another_word_is_404(): void
    {
        $mine = $this->makeWord('mine');
        $other = $this->makeWord('other');
        $otherCtx = $other->contexts()->first();

        $this->patchJson("/api/words/{$mine->id}/contexts/{$otherCtx->id}", ['meaning' => 'x', 'meaning_source' => 'user'])->assertNotFound();
    }

    public function test_requires_authentication(): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', '')->getJson('/api/words')->assertUnauthorized();
    }

    // ---------- ngữ cảnh ----------

    public function test_update_context_meaning_sets_word_meaning_when_empty(): void
    {
        $word = $this->makeWord('ephemeral');
        $ctx = $word->contexts()->first();

        $this->patchJson("/api/words/{$word->id}/contexts/{$ctx->id}", ['meaning' => 'ngắn ngủi', 'meaning_source' => 'dictionary'])
            ->assertOk()
            ->assertJsonPath('context.meaning', 'ngắn ngủi')
            ->assertJsonPath('context.meaning_source', 'dictionary')
            ->assertJsonPath('word.meaning', 'ngắn ngủi');

        // Từ đã có nghĩa thì giữ nguyên
        $this->patchJson("/api/words/{$word->id}/contexts/{$ctx->id}", ['meaning' => 'thoáng qua', 'meaning_source' => 'user'])
            ->assertOk()
            ->assertJsonPath('context.meaning', 'thoáng qua')
            ->assertJsonPath('word.meaning', 'ngắn ngủi');

        $this->patchJson("/api/words/{$word->id}/contexts/{$ctx->id}", ['meaning' => 'x', 'meaning_source' => 'ai'])
            ->assertUnprocessable()->assertJsonValidationErrors(['meaning_source']);
    }

    public function test_cannot_delete_last_context(): void
    {
        $word = $this->makeWord('ephemeral');
        $first = $word->contexts()->first();
        $second = WordContext::create([
            'user_word_id' => $word->id, 'user_id' => $this->user->id,
            'sentence' => 'Another ephemeral thing.', 'sentence_hash' => hash('sha256', 'another'),
        ]);

        $this->deleteJson("/api/words/{$word->id}/contexts/{$second->id}")->assertNoContent();
        $this->deleteJson("/api/words/{$word->id}/contexts/{$first->id}")
            ->assertUnprocessable()
            ->assertJsonPath('errors.context.0', 'Không thể xóa câu cuối cùng của từ.');

        $this->assertSame(1, $word->contexts()->count());
    }

    // ---------- meaning-candidates, dictionary ----------

    public function test_meaning_candidates_for_existing_word(): void
    {
        $this->fakeDictionary();
        $word = $this->makeWord('ephemeral', ['meaning' => 'phù du']);

        $this->getJson("/api/words/{$word->id}/meaning-candidates")->assertOk()
            ->assertJsonPath('meaning_candidates.0.key', 'current')
            ->assertJsonPath('meaning_candidates.0.source', 'translation')
            ->assertJsonPath('meaning_candidates.0.text', 'phù du')
            ->assertJsonPath('meaning_candidates.1.source', 'dictionary')
            ->assertJsonCount(4, 'meaning_candidates');

        // Lần sau lấy từ cache
        $this->getJson("/api/words/{$word->id}/meaning-candidates")->assertOk();
        Http::assertSentCount(1);
    }

    public function test_meaning_candidates_are_capped_at_8(): void
    {
        $defs = array_map(fn ($i) => ['definition' => "Definition {$i}"], range(1, 12));
        Http::fake([self::DICT_URL => Http::response([['word' => 'run', 'meanings' => [['partOfSpeech' => 'verb', 'definitions' => $defs]]]])]);

        $this->postJson('/api/words', $this->payload(['text' => 'run', 'sentence' => 'I run daily.', 'translation' => 'chạy']))
            ->assertCreated()
            ->assertJsonCount(8, 'meaning_candidates')
            ->assertJsonPath('meaning_candidates.0.key', 'translation');
    }

    public function test_dictionary_lookup(): void
    {
        $this->fakeDictionary();

        $this->getJson('/api/dictionary/lookup?text=Ephemeral&lang=en')->assertOk()
            ->assertJsonPath('entry.text', 'Ephemeral')
            ->assertJsonPath('entry.phonetic', '/ɪˈfem(ə)rəl/')
            ->assertJsonPath('entry.audio_url', 'https://audio.example/ephemeral.mp3')
            ->assertJsonPath('entry.meanings.0', [
                'part_of_speech' => 'adjective', 'definition' => 'Lasting for a very short time.', 'example' => 'fashions are ephemeral',
            ])
            ->assertJsonPath('entry.meanings.1.example', null)
            ->assertJsonCount(3, 'entry.meanings');

        $this->getJson('/api/dictionary/lookup?text=hola&lang=es')->assertOk()->assertExactJson(['entry' => null]);
        $this->getJson('/api/dictionary/lookup')->assertUnprocessable()->assertJsonValidationErrors(['text', 'lang']);
    }
}
