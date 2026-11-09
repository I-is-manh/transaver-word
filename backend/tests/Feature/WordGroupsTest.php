<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\Deck;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Gom nhóm "Từ của tôi" theo ngôn ngữ và thời gian (contract mục 3.11, v0.17). */
class WordGroupsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-09 03:00:00');
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123', 'timezone' => 'Asia/Ho_Chi_Minh']);
        $this->actingAs($this->user, 'sanctum');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Lưu từ lúc $savedUtc (giờ UTC). */
    private function word(string $text, string $savedUtc, array $attrs = [], ?User $owner = null): UserWord
    {
        $owner ??= $this->user;
        $w = (new UserWord)->forceFill(array_merge([
            'user_id' => $owner->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => mb_strtolower($text), 'meaning' => "nghĩa {$text}",
            'created_at' => Carbon::parse($savedUtc, 'UTC'), 'updated_at' => Carbon::parse($savedUtc, 'UTC'),
        ], $attrs));
        $w->save();
        WordContext::create(['user_word_id' => $w->id, 'user_id' => $owner->id, 'sentence' => "A {$text}.", 'sentence_hash' => hash('sha256', $text.$w->id)]);

        return $w;
    }

    private function fetchGroups(string $query): array
    {
        return $this->getJson("/api/words/groups?{$query}")->assertOk()->json('data');
    }

    // ---------- ngôn ngữ ----------

    public function test_languages_sorted_and_excludes_trash(): void
    {
        $this->word('a', '2026-11-01 01:00');
        $this->word('b', '2026-11-01 01:00');
        $this->word('你好', '2026-11-01 01:00', ['source_lang' => 'zh-cn', 'normalized_text' => '你好']);
        $this->word('谢谢', '2026-11-01 01:00', ['source_lang' => 'zh-cn', 'normalized_text' => '谢谢']);
        $this->word('hola', '2026-11-01 01:00', ['source_lang' => 'es']);
        $this->word('adios', '2026-11-01 01:00', ['source_lang' => 'es'])->delete();
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $this->word('bonjour', '2026-11-01 01:00', ['source_lang' => 'fr'], $other);

        $this->getJson('/api/words/languages')->assertOk()->assertExactJson(['data' => [
            ['lang' => 'en', 'count' => 2],
            ['lang' => 'zh-cn', 'count' => 2],
            ['lang' => 'es', 'count' => 1],
        ]]);
    }

    // ---------- ranh giới ngày theo múi giờ ----------

    public function test_day_boundary_uses_user_timezone(): void
    {
        $this->word('late', '2026-11-08 16:30');   // 23:30 ngày 08 giờ VN
        $this->word('midnight', '2026-11-08 17:30'); // 00:30 ngày 09 giờ VN
        $this->word('morning', '2026-11-08 01:00'); // 08:00 ngày 08 giờ VN

        $this->assertSame([
            ['key' => '2026-11-09', 'from' => '2026-11-09', 'to' => '2026-11-09', 'count' => 1],
            ['key' => '2026-11-08', 'from' => '2026-11-08', 'to' => '2026-11-08', 'count' => 2],
        ], $this->fetchGroups('by=day'));

        $res = $this->getJson('/api/words?sort=-created_at')->assertOk();
        $this->assertSame(['2026-11-09', '2026-11-08', '2026-11-08'], array_column($res->json('data'), 'saved_date'));

        // Lọc theo ngày giờ VN, tính cả hai đầu
        $this->assertSame(['late', 'morning'], array_column($this->getJson('/api/words?saved_from=2026-11-08&saved_to=2026-11-08')->json('data'), 'text'));
        $this->assertSame(['midnight'], array_column($this->getJson('/api/words?saved_from=2026-11-09')->json('data'), 'text'));
        $this->assertSame(['late', 'morning'], array_column($this->getJson('/api/words?saved_to=2026-11-08')->json('data'), 'text'));
    }

    public function test_other_timezone_groups_differently(): void
    {
        $this->user->forceFill(['timezone' => 'America/New_York'])->save(); // UTC−5 vào tháng 11
        $this->word('late', '2026-11-08 16:30');   // 11:30 ngày 08 ở New York
        $this->word('evening', '2026-11-09 02:00'); // 21:00 ngày 08 ở New York

        $this->assertSame([['key' => '2026-11-08', 'from' => '2026-11-08', 'to' => '2026-11-08', 'count' => 2]], $this->fetchGroups('by=day'));
        $this->assertSame(['2026-11-08', '2026-11-08'], array_column($this->getJson('/api/words')->json('data'), 'saved_date'));
    }

    public function test_month_and_year_boundaries(): void
    {
        $this->word('dec31', '2025-12-31 16:30');  // 23:30 31/12/2025 giờ VN
        $this->word('jan1', '2025-12-31 17:30');   // 00:30 01/01/2026 giờ VN
        $this->word('feb', '2026-02-10 03:00');
        $this->word('nov', '2026-11-08 03:00');

        $this->assertSame([
            ['key' => '2026-11', 'from' => '2026-11-01', 'to' => '2026-11-30', 'count' => 1],
            ['key' => '2026-02', 'from' => '2026-02-01', 'to' => '2026-02-28', 'count' => 1],
            ['key' => '2026-01', 'from' => '2026-01-01', 'to' => '2026-01-31', 'count' => 1],
            ['key' => '2025-12', 'from' => '2025-12-01', 'to' => '2025-12-31', 'count' => 1],
        ], $this->fetchGroups('by=month'));

        $this->assertSame([
            ['key' => '2025', 'from' => '2025-01-01', 'to' => '2025-12-31', 'count' => 1],
            ['key' => '2026', 'from' => '2026-01-01', 'to' => '2026-12-31', 'count' => 3],
        ], $this->fetchGroups('by=year&order=asc'));

        $this->assertSame(['2026-01', '2026-02'], array_column(array_slice($this->fetchGroups('by=month&order=asc'), 1, 2), 'key'));
    }

    // ---------- kết hợp bộ lọc ----------

    public function test_groups_share_filters_with_list_and_counts_match(): void
    {
        $deck = Deck::create(['user_id' => $this->user->id, 'name' => 'IELTS']);
        $words = [
            $this->word('apple', '2026-11-08 03:00', ['lapses' => 4]),
            $this->word('apply', '2026-11-08 04:00', ['status' => 'known']),
            $this->word('give up', '2026-11-07 03:00', ['kind' => 'phrase']),
            $this->word('appetite', '2026-10-01 03:00'),
            $this->word('苹果', '2026-11-08 05:00', ['source_lang' => 'zh-cn', 'normalized_text' => '苹果', 'meaning' => 'quả táo app']),
        ];
        $deck->words()->attach([$words[0]->id, $words[3]->id], ['added_at' => now()]);
        $this->word('apron', '2026-11-08 06:00')->delete(); // thùng rác: không tính

        $filters = [
            'lang=en',
            'lang=en&q=app',
            'q=app',
            'lang=en&status=learning',
            'lang=en&kind=phrase',
            'hard=1',
            "deck_id={$deck->id}",
            'lang=zh-cn',
            'lang=en&saved_from=2026-11-01&saved_to=2026-11-30',
        ];
        foreach ($filters as $f) {
            $total = $this->getJson("/api/words?{$f}&per_page=100")->assertOk()->json('meta.total');
            foreach (['day', 'month', 'year'] as $by) {
                $sum = array_sum(array_column($this->fetchGroups("by={$by}&{$f}"), 'count'));
                $this->assertSame($total, $sum, "{$f} by={$by}");
            }
        }

        // apple (08/11) và appetite (01/10); apply đã biết, 苹果 khác ngôn ngữ
        $this->assertSame([
            ['key' => '2026-11-08', 'from' => '2026-11-08', 'to' => '2026-11-08', 'count' => 1],
            ['key' => '2026-10-01', 'from' => '2026-10-01', 'to' => '2026-10-01', 'count' => 1],
        ], $this->fetchGroups('by=day&lang=en&q=app&status=learning'));
    }

    // ---------- 422 ----------

    public function test_validation_errors(): void
    {
        $this->getJson('/api/words/groups')->assertUnprocessable()
            ->assertJsonPath('errors.by.0', 'Hãy chọn cách nhóm: ngày, tháng hoặc năm.');
        $this->getJson('/api/words/groups?by=week')->assertUnprocessable()
            ->assertJsonPath('errors.by.0', 'Cách nhóm phải là ngày (day), tháng (month) hoặc năm (year).');
        $this->getJson('/api/words/groups?by=day&order=up')->assertUnprocessable()->assertJsonValidationErrors(['order']);
        $this->getJson('/api/words?saved_from=09/11/2026')->assertUnprocessable()->assertJsonValidationErrors(['saved_from']);
        $this->getJson('/api/words?saved_from=2026-11-09&saved_to=2026-11-01')->assertUnprocessable()
            ->assertJsonPath('errors.saved_to.0', 'Ngày kết thúc phải từ ngày bắt đầu trở đi.');
        $this->getJson('/api/words?lang=x')->assertUnprocessable()->assertJsonPath('errors.lang.0', 'Mã ngôn ngữ không hợp lệ.');
        $this->getJson('/api/words/groups?by=day&deck_id=999999')->assertNotFound();
    }

    public function test_empty_and_auth(): void
    {
        $this->getJson('/api/words/groups?by=day')->assertOk()->assertExactJson(['by' => 'day', 'data' => []]);
        $this->getJson('/api/words/languages')->assertOk()->assertExactJson(['data' => []]);

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', '')->getJson('/api/words/languages')->assertUnauthorized();
        $this->withHeader('Authorization', '')->getJson('/api/words/groups?by=day')->assertUnauthorized();
    }
}
