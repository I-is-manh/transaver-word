<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Mail\DailyReminderMail;
use App\Models\User;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Support\UserSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** docs/api-contract.md mục 6 */
class SettingsStatsAccountTest extends TestCase
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

    private function word(string $text, array $attrs = [], ?User $owner = null): UserWord
    {
        $owner ??= $this->user;
        $w = (new UserWord)->forceFill(array_merge([
            'user_id' => $owner->id, 'source_lang' => 'en', 'target_lang' => 'vi',
            'text' => $text, 'normalized_text' => $text, 'meaning' => "nghĩa {$text}",
        ], $attrs));
        $w->save();
        WordContext::create(['user_word_id' => $w->id, 'user_id' => $owner->id, 'sentence' => "A {$text}.", 'sentence_hash' => hash('sha256', $text)]);

        return $w;
    }

    // ---------- settings ----------

    public function test_get_default_settings(): void
    {
        $this->getJson('/api/settings')->assertOk()->assertExactJson(['settings' => [
            'timezone' => 'Asia/Ho_Chi_Minh',
            'daily_new_words' => 7,
            'reminder_time' => '21:00',
            'reminder_channels' => ['browser'],
            'exercise_types' => ['flashcard', 'mcq', 'cloze'],
            'save_page_url' => true,
            'daily_review_limit' => 150,
            'desired_retention' => 0.9,
            'card_display' => ['phonetic' => true, 'english_definition' => false, 'context_sentence' => true],
            'weekly_report' => true,
            'appearance' => 'system',
        ]]);
    }

    public function test_patch_settings_marks_source_user(): void
    {
        $this->patchJson('/api/settings', [
            'timezone' => 'Europe/London',
            'daily_new_words' => 12,
            'reminder_time' => null,
            'reminder_channels' => ['email', 'browser'],
            'exercise_types' => ['mcq', 'dictation'],
            'card_display' => ['english_definition' => true],
            'desired_retention' => 0.85,
        ])->assertOk()
            ->assertJsonPath('settings.timezone', 'Europe/London')
            ->assertJsonPath('settings.daily_new_words', 12)
            ->assertJsonPath('settings.reminder_time', null)
            ->assertJsonPath('settings.reminder_channels', ['email', 'browser'])
            ->assertJsonPath('settings.exercise_types', ['flashcard', 'mcq', 'dictation'])
            ->assertJsonPath('settings.card_display', ['phonetic' => true, 'english_definition' => true, 'context_sentence' => true])
            ->assertJsonPath('settings.desired_retention', 0.85)
            ->assertJsonPath('settings.daily_review_limit', 150);

        $sources = UserSettings::sources($this->user->fresh());
        $this->assertSame('user', $sources['daily_new_words']);
        $this->assertSame('default', $sources['daily_review_limit']);
        $this->assertSame('Europe/London', $this->user->fresh()->timezone);
    }

    public function test_patch_settings_validation(): void
    {
        $this->patchJson('/api/settings', [
            'daily_new_words' => 0,
            'reminder_time' => '25:00',
            'reminder_channels' => ['sms'],
            'exercise_types' => ['quiz'],
            'daily_review_limit' => 10,
            'desired_retention' => 0.99,
            'timezone' => 'Moon/Base',
            'save_page_url' => 'abc',
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'daily_new_words', 'reminder_time', 'reminder_channels.0', 'exercise_types.0',
            'daily_review_limit', 'desired_retention', 'timezone', 'save_page_url',
        ])->assertJsonPath('errors.reminder_time.0', 'Giờ nhắc phải có dạng HH:MM, ví dụ 21:30.');
    }

    public function test_appearance_setting(): void
    {
        // User cũ: bản lưu chưa có khóa appearance → đọc ra "system"
        $record = $this->user->settings;
        $stored = $record->settings;
        unset($stored['appearance']);
        $record->settings = $stored;
        $record->save();
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('settings.appearance', 'system');

        foreach (['light', 'dark', 'system'] as $mode) {
            $this->patchJson('/api/settings', ['appearance' => $mode])->assertOk()->assertJsonPath('settings.appearance', $mode);
        }
        $this->assertSame('user', UserSettings::sources($this->user->fresh())['appearance']);

        $this->patchJson('/api/settings', ['appearance' => 'blue'])->assertUnprocessable()
            ->assertJsonPath('errors.appearance.0', 'Giao diện không hợp lệ.');

        // Onboarding không đụng tới appearance
        $this->patchJson('/api/settings', ['appearance' => 'dark'])->assertOk();
        $this->postJson('/api/onboarding', ['goal' => 'exam', 'level' => 'beginner', 'daily_minutes' => 5])
            ->assertOk()->assertJsonPath('settings.appearance', 'dark');
    }

    // ---------- onboarding ----------

    public function test_onboarding_maps_answers_and_completes(): void
    {
        $this->postJson('/api/onboarding', ['goal' => 'exam', 'level' => 'beginner', 'daily_minutes' => 20])->assertOk()
            ->assertJsonPath('user.onboarding_completed', true)
            ->assertJsonPath('settings.daily_new_words', 15)
            ->assertJsonPath('settings.exercise_types', ['flashcard', 'mcq'])
            ->assertJsonPath('settings.desired_retention', 0.92);

        $this->assertSame('onboarding', UserSettings::sources($this->user->fresh())['daily_new_words']);
        $this->getJson('/api/me')->assertJsonPath('user.onboarding_completed', true);
    }

    public function test_onboarding_again_overwrites_onboarding_but_not_user_settings(): void
    {
        $this->postJson('/api/onboarding', ['goal' => 'exam', 'level' => 'beginner', 'daily_minutes' => 20])->assertOk();
        $this->patchJson('/api/settings', ['daily_new_words' => 9])->assertOk();

        $this->postJson('/api/onboarding', ['goal' => 'hobby', 'level' => 'advanced', 'daily_minutes' => 5])->assertOk()
            ->assertJsonPath('settings.daily_new_words', 9)
            ->assertJsonPath('settings.exercise_types', ['flashcard', 'mcq', 'cloze'])
            ->assertJsonPath('settings.desired_retention', 0.9);

        $this->postJson('/api/onboarding', ['goal' => 'x', 'level' => 'y', 'daily_minutes' => 7])->assertUnprocessable()
            ->assertJsonValidationErrors(['goal', 'level', 'daily_minutes']);
    }

    // ---------- stats ----------

    public function test_stats_summary(): void
    {
        $this->word('a');                                                                          // mới
        $this->word('b', ['fsrs_state' => 2, 'stability' => 30, 'due_at' => now()->addDays(20)]); // đã thuộc
        $this->word('c', ['fsrs_state' => 2, 'stability' => 3, 'lapses' => 4, 'due_at' => now()->subHour()]); // khó, đến hạn
        $this->word('d', ['status' => 'known']);
        $this->word('e')->delete();                                                                 // thùng rác
        $other = app(CreateUser::class)->handle(['email' => 'o@example.com', 'password' => 'password123']);
        $this->word('z', [], $other);

        $this->getJson('/api/stats/summary')->assertOk()
            ->assertJsonPath('saved_count', 4)
            ->assertJsonPath('learning_count', 3)
            ->assertJsonPath('known_count', 1)
            ->assertJsonPath('mastered_count', 1)
            ->assertJsonPath('hard_count', 1)
            ->assertJsonPath('due_today', 1)
            ->assertJsonPath('new_available_today', 1)
            ->assertJsonStructure(['today' => ['date', 'goal_met'], 'streak' => ['current'], 'xp' => ['total', 'level']]);
    }

    public function test_today_endpoint(): void
    {
        $this->word('c', ['fsrs_state' => 2, 'stability' => 3, 'due_at' => now()->subHour()]);

        $this->getJson('/api/today')->assertOk()->assertExactJson([
            'date' => '2026-11-10', 'studied' => false, 'due_count' => 1,
            'reminder_time' => '21:00', 'reminder_channels' => ['browser'],
        ]);

        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-10', 'reviews_count' => 2]);
        $this->getJson('/api/today')->assertJsonPath('studied', true);
    }

    // ---------- xóa tài khoản ----------

    public function test_delete_account_requires_correct_password_and_removes_everything(): void
    {
        $this->word('a');
        $this->user->createToken('extension');
        $this->postJson('/api/onboarding', ['goal' => 'exam', 'level' => 'beginner', 'daily_minutes' => 5]);

        $this->deleteJson('/api/account', ['password' => 'sai'])->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Mật khẩu không đúng.');
        $this->deleteJson('/api/account', [])->assertUnprocessable()->assertJsonValidationErrors(['password']);

        $this->deleteJson('/api/account', ['password' => 'password123'])->assertNoContent();

        $this->assertNull(User::find($this->user->id));
        foreach (['user_words', 'word_contexts', 'user_settings', 'user_progress', 'personal_access_tokens'] as $table) {
            $column = $table === 'personal_access_tokens' ? 'tokenable_id' : 'user_id';
            $this->assertSame(0, DB::table($table)->where($column, $this->user->id)->count(), $table);
        }
    }

    // ---------- email nhắc học ----------

    private function enableEmail(User $user, string $time = '21:00'): void
    {
        UserSettings::put($user, ['reminder_channels' => ['browser', 'email'], 'reminder_time' => $time], 'user');
    }

    public function test_reminder_sent_once_after_reminder_time_when_not_studied(): void
    {
        Mail::fake();
        $this->enableEmail($this->user, '21:00');
        $browserOnly = app(CreateUser::class)->handle(['email' => 'b@example.com', 'password' => 'password123']);

        // 20:50 giờ VN: chưa tới giờ
        Carbon::setTestNow(Carbon::parse('2026-11-10 20:50', 'Asia/Ho_Chi_Minh')->utc());
        $this->artisan('reminders:send')->assertSuccessful();
        Mail::assertNothingOutgoing();

        // 21:05: gửi
        Carbon::setTestNow(Carbon::parse('2026-11-10 21:05', 'Asia/Ho_Chi_Minh')->utc());
        $this->artisan('reminders:send')->assertSuccessful();
        Mail::assertQueued(DailyReminderMail::class, fn ($m) => $m->hasTo('manh@example.com'));
        Mail::assertNotQueued(DailyReminderMail::class, fn ($m) => $m->hasTo($browserOnly->email));
        $this->assertDatabaseHas('notification_logs', ['user_id' => $this->user->id, 'type' => 'daily_reminder', 'for_date' => '2026-11-10', 'status' => 'sent']);

        // 21:20: không gửi lại
        Carbon::setTestNow(Carbon::parse('2026-11-10 21:20', 'Asia/Ho_Chi_Minh')->utc());
        $this->artisan('reminders:send')->assertSuccessful();
        Mail::assertQueuedCount(1);
    }

    public function test_reminder_skipped_when_studied_or_banned_or_no_time(): void
    {
        Mail::fake();
        $this->enableEmail($this->user, '08:00');
        DB::table('daily_activity')->insert(['user_id' => $this->user->id, 'activity_date' => '2026-11-10', 'reviews_count' => 1]);

        $banned = app(CreateUser::class)->handle(['email' => 'ban@example.com', 'password' => 'password123']);
        $this->enableEmail($banned, '08:00');
        $banned->update(['status' => User::STATUS_BANNED]);

        $noTime = app(CreateUser::class)->handle(['email' => 'nt@example.com', 'password' => 'password123']);
        UserSettings::put($noTime, ['reminder_channels' => ['email'], 'reminder_time' => null], 'user');

        $this->artisan('reminders:send')->assertSuccessful();
        Mail::assertNothingOutgoing();
    }

    public function test_reminder_mail_renders_gently(): void
    {
        $html = (new DailyReminderMail($this->user, 12))->render();
        $this->assertStringContainsString('12 từ', $html);
        $this->assertStringContainsString('/review', $html);
    }

    public function test_endpoints_require_auth(): void
    {
        $this->app['auth']->forgetGuards();
        foreach (['/api/settings', '/api/stats/summary', '/api/today'] as $url) {
            $this->withHeader('Authorization', '')->getJson($url)->assertUnauthorized();
        }
    }
}
