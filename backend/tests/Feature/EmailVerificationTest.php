<?php

namespace Tests\Feature;

use App\Mail\DailyReminderMail;
use App\Mail\VerifyEmailMail;
use App\Mail\WeeklyReportMail;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.frontend_url' => 'http://localhost:5173']);
        Mail::fake();
    }

    private function register(string $email = 'moi@example.com'): array
    {
        return $this->postJson('/api/auth/register', [
            'email' => $email, 'password' => 'matkhau123', 'password_confirmation' => 'matkhau123',
        ])->assertCreated()->json();
    }

    private function verifyUrlFor(string $email): string
    {
        $url = null;
        Mail::assertQueued(VerifyEmailMail::class, function (VerifyEmailMail $m) use ($email, &$url) {
            if ($m->user->email !== $email) {
                return false;
            }
            $url = $m->verifyUrl;

            return true;
        });

        return $url;
    }

    public function test_register_sends_email_and_user_is_unverified(): void
    {
        $res = $this->register();
        $this->assertFalse($res['user']['email_verified']);
        Mail::assertQueued(VerifyEmailMail::class, fn ($m) => $m->hasTo('moi@example.com'));
    }

    public function test_clicking_link_verifies_and_redirects(): void
    {
        $this->register();
        $url = $this->verifyUrlFor('moi@example.com');

        $this->get($url)->assertRedirect('http://localhost:5173/email-verified?status=success');
        $this->assertNotNull(User::where('email', 'moi@example.com')->value('email_verified_at'));

        $this->get($url)->assertRedirect('http://localhost:5173/email-verified?status=already');
    }

    public function test_tampered_or_expired_link_is_rejected(): void
    {
        $this->register();
        $url = $this->verifyUrlFor('moi@example.com');

        $this->get($url.'x')->assertRedirect('http://localhost:5173/email-verified?status=expired');

        $user = User::where('email', 'moi@example.com')->first();
        $expired = URL::temporarySignedRoute('verification.verify', now()->subMinute(), ['id' => $user->id, 'hash' => sha1($user->email)]);
        $this->get($expired)->assertRedirect('http://localhost:5173/email-verified?status=expired');

        $wrongHash = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1('other@example.com')]);
        $this->get($wrongHash)->assertRedirect('http://localhost:5173/email-verified?status=invalid');

        $this->assertNull($user->refresh()->email_verified_at);
    }

    public function test_me_reports_verified_after_click(): void
    {
        $token = $this->register()['token'];
        $this->get($this->verifyUrlFor('moi@example.com'));
        $this->withToken($token)->getJson('/api/me')->assertJsonPath('user.email_verified', true);
    }

    public function test_resend_is_throttled_and_skips_verified(): void
    {
        $token = $this->register()['token'];
        $this->withToken($token)->postJson('/api/email/verification-notification')->assertStatus(202)->assertJsonPath('sent', true);
        $this->withToken($token)->postJson('/api/email/verification-notification')->assertStatus(429)->assertHeader('Retry-After');
        Mail::assertQueued(VerifyEmailMail::class, 2);

        User::where('email', 'moi@example.com')->update(['email_verified_at' => now()]);
        $this->app['auth']->forgetGuards(); // test giữ user cũ giữa các request
        $this->withToken($token)->postJson('/api/email/verification-notification')->assertOk()->assertJsonPath('sent', false);
    }

    public function test_resend_requires_auth(): void
    {
        $this->postJson('/api/email/verification-notification')->assertUnauthorized();
    }

    public function test_queued_reminder_failure_is_logged(): void
    {
        $user = User::factory()->create();
        DB::table('notification_logs')->insert([
            'user_id' => $user->id, 'type' => 'daily_reminder', 'for_date' => '2026-11-09', 'status' => 'sent', 'sent_at' => now(),
        ]);
        (new DailyReminderMail($user, 3, '2026-11-09'))->failed(new \RuntimeException('SMTP down'));
        $this->assertDatabaseHas('notification_logs', ['user_id' => $user->id, 'status' => 'failed', 'error' => 'SMTP down']);
    }

    public function test_all_mailables_are_queued(): void
    {
        foreach ([VerifyEmailMail::class, DailyReminderMail::class, WeeklyReportMail::class] as $class) {
            $this->assertContains(ShouldQueue::class, class_implements($class), $class);
        }
    }
}
