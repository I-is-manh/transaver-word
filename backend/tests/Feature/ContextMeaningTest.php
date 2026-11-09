<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Contracts\ContextMeaning;
use App\Contracts\ContextMeaningService;
use App\Models\User;
use App\Providers\AppServiceProvider;
use App\Services\Ai\NullContextMeaningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/** Chỗ cắm AI cho nghĩa theo ngữ cảnh (orchestration-plan mục 1). Không gọi API AI thật. */
class ContextMeaningTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private FakeContextMeaningService $fake;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake(['api.dictionaryapi.dev/*' => Http::response([], 404)]);
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123']);
        $this->actingAs($this->user, 'sanctum');
        $this->fake = new FakeContextMeaningService;
        $this->app->instance(ContextMeaningService::class, $this->fake);
    }

    private function save(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/words', array_merge([
            'text' => 'bank', 'source_lang' => 'en', 'target_lang' => 'vi',
            'sentence' => 'We sat on the bank of the river.', 'translation' => 'ngân hàng',
        ], $overrides));
    }

    public function test_ai_meaning_is_used_for_context_and_word(): void
    {
        $this->save()->assertCreated()
            ->assertJsonPath('context.meaning', 'bờ sông')
            ->assertJsonPath('context.meaning_source', 'ai')
            ->assertJsonPath('word.meaning', 'bờ sông')
            ->assertJsonPath('meaning_candidates.0.text', 'ngân hàng'); // bản dịch vẫn là gợi ý để chọn

        $this->assertSame([['bank', 'We sat on the bank of the river.', 'en', 'vi']], $this->fake->calls);
        $row = DB::table('context_meaning_cache')->first();
        $this->assertSame('bờ sông', $row->meaning);
        $this->assertSame('fake-model', $row->model);
        $this->assertSame(64, strlen($row->cache_key));
        $this->assertStringNotContainsString('river', $row->cache_key);
    }

    public function test_same_word_and_sentence_uses_cache(): void
    {
        $this->save()->assertCreated();
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $this->actingAs($other, 'sanctum');

        $this->save(['text' => 'BANK', 'sentence' => 'We sat on the  bank of the river.'])->assertCreated()
            ->assertJsonPath('context.meaning_source', 'ai');

        $this->assertCount(1, $this->fake->calls);
    }

    public function test_provider_error_falls_back_to_translation(): void
    {
        $this->fake->throw = true;

        $this->save()->assertCreated()
            ->assertJsonPath('context.meaning', 'ngân hàng')
            ->assertJsonPath('context.meaning_source', 'translation');
        $this->assertSame(0, DB::table('context_meaning_cache')->count());
    }

    public function test_provider_returning_null_falls_back_to_translation(): void
    {
        $this->fake->result = null;

        $this->save()->assertCreated()->assertJsonPath('context.meaning_source', 'translation');
    }

    public function test_default_binding_is_null_service_and_unknown_provider_falls_back(): void
    {
        $this->app->forgetInstance(ContextMeaningService::class);
        $this->app->offsetUnset(ContextMeaningService::class);
        $this->app->register(AppServiceProvider::class, true);

        config(['services.ai.provider' => null]);
        $this->assertInstanceOf(NullContextMeaningService::class, app(ContextMeaningService::class));

        config(['services.ai.provider' => 'khong-co']);
        $this->assertInstanceOf(NullContextMeaningService::class, app(ContextMeaningService::class));

        config(['services.ai.provider' => 'fake', 'services.ai.providers' => ['fake' => FakeContextMeaningService::class]]);
        $this->assertInstanceOf(FakeContextMeaningService::class, app(ContextMeaningService::class));
    }
}

/** Provider giả cho test. */
class FakeContextMeaningService implements ContextMeaningService
{
    /** @var list<array{0: string, 1: string, 2: string, 3: string}> */
    public array $calls = [];

    public bool $throw = false;

    public ?ContextMeaning $result;

    public function __construct()
    {
        $this->result = new ContextMeaning('bờ sông', 'fake-model');
    }

    public function meaningFor(string $text, string $sentence, string $sourceLang, string $targetLang): ?ContextMeaning
    {
        $this->calls[] = [$text, $sentence, $sourceLang, $targetLang];
        if ($this->throw) {
            throw new RuntimeException('API lỗi');
        }

        return $this->result;
    }
}
