<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Mail\WeeklyReportMail;
use App\Models\ReviewSession;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Support\UserSettings;
use Database\Seeders\AchievementSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** docs/api-contract.md mục 8 và 9 */
class MotivationAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(AchievementSeeder::class);
        Carbon::setTestNow('2026-11-10 03:00:00'); // thứ Ba, 10:00 giờ Việt Nam
        $this->user = app(CreateUser::class)->handle(['email' => 'manh@example.com', 'password' => 'password123', 'timezone' => 'Asia/Ho_Chi_Minh']);
        $this->actingAs($this->user, 'sanctum');
        Http::fake(['api.dictionaryapi.dev/*' => Http::response([], 404)]);
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

    private function dueWord(string $text, array $attrs = []): UserWord
    {
        return $this->word($text, array_merge([
            'fsrs_state' => 2, 'stability' => 3, 'difficulty' => 5, 'reps' => 3,
            'due_at' => now()->subHour(), 'last_review_at' => now()->subDays(3), 'scheduled_days' => 3,
        ], $attrs));
    }

    private function newSession(): ReviewSession
    {
        return ReviewSession::create(['user_id' => $this->user->id, 'mode' => 'daily', 'started_at' => now()]);
    }

    private function answer(ReviewSession $s, UserWord $w, int $rating = 3): TestResponse
    {
        return $this->postJson('/api/review/answer', [
            'client_uuid' => (string) Str::uuid(), 'session_id' => $s->id, 'user_word_id' => $w->id,
            'exercise_type' => 'flashcard', 'rating' => $rating,
        ])->assertOk();
    }

    private function codes(array $achievements): array
    {
        return array_column($achievements, 'code');
    }

    // ---------- huy hiệu ----------

    public function test_achievement_list_hides_unearned_hidden(): void
    {
        $data = $this->getJson('/api/achievements')->assertOk()->json('data');
        $this->assertSame(['first_save', 'first_review', 'streak_7', 'streak_30', 'mastered_50', 'mastered_250'], $this->codes($data));
        $this->assertSame(['code' => 'first_save', 'name' => 'Từ đầu tiên', 'description' => 'Lưu từ đầu tiên của bạn.', 'icon' => 'save', 'xp_reward' => 10, 'earned_at' => null], $data[0]);
    }

    public function test_first_save_awarded_once_with_xp(): void
    {
        $payload = ['text' => 'ephemeral', 'source_lang' => 'en', 'target_lang' => 'vi', 'sentence' => 'So ephemeral.'];
        $res = $this->postJson('/api/words', $payload)->assertCreated();
        $this->assertSame(['first_save'], $this->codes($res->json('new_achievements')));
        $this->assertSame('2026-11-10T03:00:00Z', $res->json('new_achievements.0.earned_at'));

        $this->postJson('/api/words', $payload + ['page_url' => null])->assertOk()->assertJsonPath('new_achievements', []);
        $this->assertSame(10, (int) $this->user->progress()->value('total_xp'));
        $this->assertSame('2026-11-10T03:00:00Z', collect($this->getJson('/api/achievements')->json('data'))->firstWhere('code', 'first_save')['earned_at']);
    }

    public function test_sites_10_hidden_achievement(): void
    {
        foreach (range(1, 9) as $i) {
            $this->postJson('/api/words', ['text' => "w{$i}", 'source_lang' => 'en', 'target_lang' => 'vi', 'sentence' => "s {$i}", 'page_url' => "https://www.site{$i}.com/a"]);
        }
        $this->postJson('/api/words', ['text' => 'dup', 'source_lang' => 'en', 'target_lang' => 'vi', 'sentence' => 'dup', 'page_url' => 'https://site1.com/other'])
            ->assertJsonPath('new_achievements', []);
        $res = $this->postJson('/api/words', ['text' => 'w10', 'source_lang' => 'en', 'target_lang' => 'vi', 'sentence' => 's 10', 'page_url' => 'https://site10.com/']);
        $this->assertSame(['sites_10'], $this->codes($res->json('new_achievements')));
        $this->assertContains('sites_10', $this->codes($this->getJson('/api/achievements')->json('data')));
    }

    public function test_first_review_and_perfect_session_at_finish(): void
    {
        $s = $this->newSession();
        foreach (range(1, 10) as $i) {
            $this->answer($s, $this->dueWord("w{$i}"), 3);
        }
        $res = $this->postJson("/api/review/sessions/{$s->id}/finish")->assertOk();
        $this->assertEqualsCanonicalizing(['first_review', 'perfect_session'], $this->codes($res->json('new_achievements')));

        // Buổi có thẻ "Quên" không được perfect_session (và first_review đã có)
        $s2 = $this->newSession();
        foreach (range(1, 10) as $i) {
            $this->answer($s2, $this->dueWord("x{$i}"), $i === 5 ? 1 : 3);
        }
        $this->postJson("/api/review/sessions/{$s2->id}/finish")->assertJsonPath('new_achievements', []);
    }

    public function test_streak_7_on_answer(): void
    {
        foreach (range(4, 10) as $d) {
            Carbon::setTestNow(Carbon::parse(sprintf('2026-11-%02d 10:00', $d), 'Asia/Ho_Chi_Minh')->utc());
            $res = $this->answer($this->newSession(), $this->dueWord("d{$d}"));
        }
        $this->assertSame(['streak_7'], $this->codes($res->json('new_achievements')));
        $this->assertSame(7, $res->json('streak.current'));
    }

    public function test_comeback_after_7_days(): void
    {
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-02', 'reviews_count' => 3]);
        $res = $this->answer($this->newSession(), $this->dueWord('back'));
        $this->assertSame(['comeback'], $this->codes($res->json('new_achievements')));
    }

    public function test_no_comeback_after_short_break(): void
    {
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-05', 'reviews_count' => 3]);
        $this->answer($this->newSession(), $this->dueWord('back'))->assertJsonPath('new_achievements', []);
    }

    public function test_mastered_50(): void
    {
        foreach (range(1, 49) as $i) {
            $this->word("m{$i}", ['fsrs_state' => 2, 'stability' => 30, 'due_at' => now()->addDays(30)]);
        }
        $w = $this->dueWord('last', ['stability' => 15, 'last_review_at' => now()->subDays(15), 'scheduled_days' => 15]);
        $res = $this->answer($this->newSession(), $w, 3)->assertJsonPath('became_mastered', true);
        $this->assertSame(['mastered_50'], $this->codes($res->json('new_achievements')));
        $this->assertSame(10 + 50 + 100, (int) $this->user->progress()->value('total_xp'));
    }

    // ---------- báo cáo tuần ----------

    public function test_weekly_report_last_full_week_and_previous(): void
    {
        // Tuần 02–08/11 (tuần trước), tuần 26/10–01/11 (tuần trước nữa)
        DB::table('daily_activity')->insert([
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-02', 'reviews_count' => 10, 'words_saved' => 2, 'xp_earned' => 80],
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-05', 'reviews_count' => 5, 'words_saved' => 0, 'xp_earned' => 40],
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-07', 'reviews_count' => 0, 'words_saved' => 3, 'xp_earned' => 0],
            ['user_id' => $this->user->id, 'activity_date' => '2026-10-28', 'reviews_count' => 4, 'words_saved' => 1, 'xp_earned' => 30],
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-10', 'reviews_count' => 99, 'words_saved' => 9, 'xp_earned' => 9], // tuần này: không tính
        ]);
        $w = $this->word('a');
        $log = fn (string $at, int $rating, bool $mastered = false) => DB::table('review_logs')->insert([
            'client_uuid' => (string) Str::uuid(), 'user_id' => $this->user->id, 'user_word_id' => $w->id,
            'exercise_type' => 'flashcard', 'rating' => $rating, 'state_before' => 2, 'elapsed_days' => 1, 'scheduled_days' => 1,
            'stability_after' => 1, 'difficulty_after' => 5, 'due_after' => now(), 'became_mastered' => $mastered,
            'reviewed_at' => Carbon::parse($at, 'Asia/Ho_Chi_Minh')->utc(),
        ]);
        $log('2026-11-02 08:00', 3, true);
        $log('2026-11-05 23:30', 1);       // 16:30 UTC, vẫn là ngày 05 giờ VN
        $log('2026-11-08 23:59', 4);
        $log('2026-11-09 00:10', 1);       // tuần này
        $log('2026-10-28 09:00', 3);
        $w->forceFill(['first_mastered_at' => Carbon::parse('2026-11-02 01:00')])->save();

        $this->getJson('/api/reports/weekly')->assertOk()->assertExactJson([
            'week_start' => '2026-11-02', 'week_end' => '2026-11-08',
            'days_active' => 2, 'reviews_count' => 15, 'words_saved' => 5,
            'newly_mastered' => 1, 'mastered_total' => 1, 'accuracy' => 0.6667, 'xp_earned' => 120,
            'previous' => ['days_active' => 1, 'reviews_count' => 4, 'words_saved' => 1, 'newly_mastered' => 0, 'accuracy' => 1],
        ]);

        $this->getJson('/api/reports/weekly?week_start=2026-10-26')->assertOk()
            ->assertJsonPath('week_end', '2026-11-01')->assertJsonPath('previous.accuracy', null);
        $this->getJson('/api/reports/weekly?week_start=2026-11-03')->assertUnprocessable()
            ->assertJsonPath('errors.week_start.0', 'Tuần phải bắt đầu từ thứ Hai.');
    }

    public function test_weekly_email_monday_8am_local_once(): void
    {
        Mail::fake();
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-03', 'reviews_count' => 5]);
        $optOut = app(CreateUser::class)->handle(['email' => 'off@example.com', 'password' => 'password123']);
        UserSettings::put($optOut, ['weekly_report' => false], 'user');
        DB::table('daily_activity')->insert(['user_id' => $optOut->id, 'activity_date' => '2026-11-03', 'reviews_count' => 5]);
        $idle = app(CreateUser::class)->handle(['email' => 'idle@example.com', 'password' => 'password123']);

        Carbon::setTestNow(Carbon::parse('2026-11-09 07:30', 'Asia/Ho_Chi_Minh')->utc()); // thứ Hai 07:30
        $this->artisan('reports:weekly')->assertSuccessful();
        Mail::assertNothingOutgoing();

        Carbon::setTestNow(Carbon::parse('2026-11-09 08:05', 'Asia/Ho_Chi_Minh')->utc());
        $this->artisan('reports:weekly')->assertSuccessful();
        $this->artisan('reports:weekly')->assertSuccessful();
        Mail::assertQueuedCount(1);
        Mail::assertQueued(WeeklyReportMail::class, fn ($m) => $m->hasTo('manh@example.com') && $m->report['days_active'] === 1);
        $this->assertDatabaseHas('notification_logs', ['user_id' => $this->user->id, 'type' => 'weekly_report', 'for_date' => '2026-11-09']);
        $this->assertSame(0, DB::table('notification_logs')->whereIn('user_id', [$optOut->id, $idle->id])->count());

        $html = (new WeeklyReportMail($this->user, ['week_start' => '2026-11-02', 'week_end' => '2026-11-08', 'days_active' => 1, 'reviews_count' => 5, 'words_saved' => 0, 'newly_mastered' => 3, 'mastered_total' => 9, 'accuracy' => 0.8, 'xp_earned' => 0]))->render();
        $this->assertStringContainsString('Tuần này bạn thuộc thêm 3 từ', $html);
    }

    // ---------- heatmap, progress, highlight ----------

    public function test_heatmap(): void
    {
        DB::table('daily_activity')->insert([
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-01', 'reviews_count' => 3, 'words_saved' => 0, 'freeze_used' => false],
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-02', 'reviews_count' => 0, 'words_saved' => 0, 'freeze_used' => true],
            ['user_id' => $this->user->id, 'activity_date' => '2026-11-03', 'reviews_count' => 0, 'words_saved' => 0, 'freeze_used' => false],
            ['user_id' => $this->user->id, 'activity_date' => '2025-11-11', 'reviews_count' => 1, 'words_saved' => 0, 'freeze_used' => false],
            ['user_id' => $this->user->id, 'activity_date' => '2025-11-10', 'reviews_count' => 1, 'words_saved' => 0, 'freeze_used' => false], // ngoài 365 ngày
        ]);

        $this->getJson('/api/stats/heatmap')->assertOk()->assertExactJson(['days' => [
            ['date' => '2025-11-11', 'reviews_count' => 1, 'words_saved' => 0, 'freeze_used' => false],
            ['date' => '2026-11-01', 'reviews_count' => 3, 'words_saved' => 0, 'freeze_used' => false],
            ['date' => '2026-11-02', 'reviews_count' => 0, 'words_saved' => 0, 'freeze_used' => true],
        ]]);
        $this->getJson('/api/stats/heatmap?from=2026-11-02&to=2026-11-05')->assertJsonCount(1, 'days');
        $this->getJson('/api/stats/heatmap?from=2024-01-01&to=2026-11-05')->assertUnprocessable();
        $this->getJson('/api/stats/heatmap?from=2026-11-05&to=2026-11-01')->assertUnprocessable();
    }

    public function test_progress_has_every_day_with_running_totals(): void
    {
        $this->word('old', ['created_at' => Carbon::parse('2026-10-01')]);
        $this->word('new', ['created_at' => Carbon::parse('2026-11-08 18:00')]); // 01:00 ngày 09 giờ VN
        $this->word('m', ['created_at' => Carbon::parse('2026-10-02'), 'first_mastered_at' => Carbon::parse('2026-11-10 01:00')]);
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-09', 'reviews_count' => 4]);

        $points = $this->getJson('/api/stats/progress?days=7')->assertOk()->assertJsonCount(7, 'points')->json('points');
        $this->assertSame(['date' => '2026-11-04', 'saved_total' => 2, 'mastered_total' => 0, 'reviews_count' => 0], $points[0]);
        $this->assertSame(['date' => '2026-11-09', 'saved_total' => 3, 'mastered_total' => 0, 'reviews_count' => 4], $points[5]);
        $this->assertSame(['date' => '2026-11-10', 'saved_total' => 3, 'mastered_total' => 1, 'reviews_count' => 0], $points[6]);
        $this->getJson('/api/stats/progress')->assertJsonCount(30, 'points');
        $this->getJson('/api/stats/progress?days=3')->assertUnprocessable();
    }

    public function test_highlight_list(): void
    {
        $this->word('ephemeral');
        $this->word('give up', ['kind' => 'phrase']);
        $this->word('known', ['status' => 'known']);
        $this->word('hola', ['source_lang' => 'es']);
        $this->word('trash')->delete();

        $res = $this->getJson('/api/words/highlight-list')->assertOk()->assertJsonPath('generated_at', '2026-11-10T03:00:00Z');
        $this->assertSame(['ephemeral', 'give up'], array_column($res->json('words'), 'text'));
        $this->assertSame(['id', 'text', 'normalized_text', 'kind', 'meaning'], array_keys($res->json('words.0')));
    }

    // ---------- admin ----------

    private function admin(): User
    {
        $admin = app(CreateUser::class)->handle(['email' => 'admin@example.com', 'password' => 'password123', 'role' => 'admin']);
        $this->actingAs($admin, 'sanctum');

        return $admin;
    }

    public function test_admin_endpoints_forbidden_for_normal_user(): void
    {
        $this->getJson('/api/admin/stats')->assertForbidden()->assertJsonPath('message', 'Bạn không có quyền thực hiện thao tác này.');
        $this->getJson('/api/admin/users')->assertForbidden();
        $this->patchJson("/api/admin/users/{$this->user->id}", ['status' => 'banned'])->assertForbidden();
    }

    public function test_admin_stats_and_users(): void
    {
        $this->word('a');
        $this->word('b');
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-09', 'reviews_count' => 2]);
        $this->answer($this->newSession(), $this->dueWord('c'));
        $this->admin();

        $this->getJson('/api/admin/stats')->assertOk()->assertExactJson([
            'users_total' => 2, 'users_active_7d' => 1, 'words_total' => 3, 'reviews_today' => 1, 'reviews_7d' => 1,
        ]);

        $res = $this->getJson('/api/admin/users?q=MANH')->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta' => ['current_page', 'total']])
            ->assertJsonPath('meta.total', 1);
        $this->assertSame([
            'id' => $this->user->id, 'email' => 'manh@example.com', 'role' => 'user', 'status' => 'active',
            'created_at' => '2026-11-10T03:00:00Z', 'words_count' => 3, 'last_active_date' => '2026-11-10',
        ], $res->json('data.0'));
        $this->getJson('/api/admin/users')->assertJsonPath('meta.total', 2);
    }

    public function test_admin_ban_revokes_tokens_and_cannot_ban_self(): void
    {
        $token = $this->user->createToken('web')->plainTextToken;
        $admin = $this->admin();

        $this->patchJson("/api/admin/users/{$this->user->id}", ['status' => 'banned'])->assertOk()
            ->assertJsonPath('user.status', 'banned');
        $this->assertSame(0, $this->user->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => 'manh@example.com', 'password' => 'password123'])->assertForbidden();

        $this->actingAs($admin, 'sanctum');
        $this->patchJson("/api/admin/users/{$this->user->id}", ['status' => 'active', 'role' => 'admin'])->assertOk()
            ->assertJsonPath('user.role', 'admin')->assertJsonPath('user.status', 'active');

        $this->patchJson("/api/admin/users/{$admin->id}", ['status' => 'banned'])->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'Bạn không thể tự khóa tài khoản của mình.');
        $this->patchJson("/api/admin/users/{$admin->id}", ['role' => 'user'])->assertUnprocessable()
            ->assertJsonPath('errors.role.0', 'Bạn không thể tự bỏ quyền admin của mình.');
        $this->patchJson('/api/admin/users/999999', ['status' => 'banned'])->assertNotFound();
        $this->patchJson("/api/admin/users/{$this->user->id}", ['status' => 'deleted'])->assertUnprocessable();
    }
}
