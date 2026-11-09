<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.google.client_id' => 'test-client',
            'services.google.client_secret' => 'test-secret',
            'services.google.redirect' => 'http://localhost:8000/auth/google/callback',
            'app.frontend_url' => 'http://localhost:5173',
        ]);
    }

    private function fakeGoogleUser(string $id, string $email, bool $verified = true, ?string $name = 'Văn Mạnh'): void
    {
        $gUser = (new SocialiteUser)->setRaw(['email_verified' => $verified])->map([
            'id' => $id, 'email' => $email, 'name' => $name,
        ]);
        $provider = Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andReturn($gUser);
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
    }

    /** Gọi callback, trả về query của URL chuyển về web. */
    private function hitCallback(): array
    {
        $res = $this->get('/auth/google/callback?code=google-code&state=x');
        $res->assertRedirect();
        $url = $res->headers->get('Location');
        $this->assertStringStartsWith('http://localhost:5173/auth/google/callback?', $url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);

        return $q;
    }

    public function test_redirect_goes_to_google(): void
    {
        $res = $this->get('/auth/google/redirect');
        $res->assertRedirect();
        $this->assertStringContainsString('accounts.google.com', $res->headers->get('Location'));
    }

    public function test_redirect_without_config_returns_error_to_frontend(): void
    {
        config(['services.google.client_id' => null]);
        $res = $this->get('/auth/google/redirect');
        $this->assertStringContainsString('error=not_configured', $res->headers->get('Location'));
    }

    public function test_new_user_is_created_and_code_exchanges_for_token(): void
    {
        $this->fakeGoogleUser('g-123', 'New.User@Gmail.com');
        $q = $this->hitCallback();
        $this->assertArrayHasKey('code', $q);

        $user = User::where('email', 'new.user@gmail.com')->firstOrFail();
        $this->assertSame('g-123', $user->google_id);
        $this->assertSame('Văn Mạnh', $user->name);
        $this->assertNotNull($user->settings);
        $this->assertNotNull($user->progress);

        $res = $this->postJson('/api/auth/google/exchange', ['code' => $q['code'], 'timezone' => 'Asia/Tokyo']);
        $res->assertOk()->assertJsonPath('created', true)
            ->assertJsonPath('user.email', 'new.user@gmail.com')
            ->assertJsonPath('user.timezone', 'Asia/Tokyo')
            ->assertJsonPath('user.onboarding_completed', false);

        $this->withToken($res->json('token'))->getJson('/api/me')->assertOk();

        // Mã chỉ dùng được một lần.
        $this->postJson('/api/auth/google/exchange', ['code' => $q['code']])
            ->assertStatus(422)->assertJsonValidationErrors('code');
    }

    public function test_existing_email_account_is_linked(): void
    {
        $existing = User::factory()->create(['email' => 'manh@example.com', 'timezone' => 'Asia/Ho_Chi_Minh']);
        $this->fakeGoogleUser('g-777', 'MANH@example.com');
        $q = $this->hitCallback();

        $this->assertSame('g-777', $existing->refresh()->google_id);
        $this->assertSame(1, User::count());
        $this->postJson('/api/auth/google/exchange', ['code' => $q['code'], 'timezone' => 'Asia/Tokyo'])
            ->assertOk()->assertJsonPath('created', false)
            ->assertJsonPath('user.id', $existing->id)
            ->assertJsonPath('user.timezone', 'Asia/Ho_Chi_Minh');
    }

    public function test_found_by_google_id_even_if_email_changed(): void
    {
        $existing = User::factory()->create(['email' => 'old@example.com', 'google_id' => 'g-1']);
        $this->fakeGoogleUser('g-1', 'renamed@example.com');
        $q = $this->hitCallback();
        $this->postJson('/api/auth/google/exchange', ['code' => $q['code']])->assertOk()->assertJsonPath('user.id', $existing->id);
    }

    public function test_unverified_email_is_rejected(): void
    {
        $this->fakeGoogleUser('g-9', 'x@example.com', verified: false);
        $this->assertSame('email_unverified', $this->hitCallback()['error']);
        $this->assertSame(0, User::count());
    }

    public function test_banned_user_gets_error(): void
    {
        User::factory()->create(['email' => 'bad@example.com', 'status' => User::STATUS_BANNED]);
        $this->fakeGoogleUser('g-5', 'bad@example.com');
        $this->assertSame('banned', $this->hitCallback()['error']);
    }

    public function test_cancel_on_google_screen(): void
    {
        $res = $this->get('/auth/google/callback?error=access_denied');
        $this->assertStringContainsString('error=cancelled', $res->headers->get('Location'));
    }

    public function test_provider_failure_returns_failed(): void
    {
        $provider = Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('stateless')->andReturnSelf();
        $provider->shouldReceive('user')->andThrow(new \RuntimeException('invalid_grant'));
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);
        $this->assertSame('failed', $this->hitCallback()['error']);
    }

    public function test_invalid_code_is_422(): void
    {
        $this->postJson('/api/auth/google/exchange', ['code' => str_repeat('a', 64)])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertNull(Cache::get('google_login:x'));
    }

    public function test_google_created_user_has_no_password_and_deletes_with_email(): void
    {
        $this->fakeGoogleUser('g-del', 'del@gmail.com');
        $q = $this->hitCallback();
        $res = $this->postJson('/api/auth/google/exchange', ['code' => $q['code']])
            ->assertOk()->assertJsonPath('user.has_password', false);
        $token = $res->json('token');

        // Không đăng nhập bằng mật khẩu được.
        $this->postJson('/api/auth/login', ['email' => 'del@gmail.com', 'password' => ''])->assertStatus(422);

        $this->withToken($token)->deleteJson('/api/account', ['confirm_email' => 'other@gmail.com'])
            ->assertStatus(422)->assertJsonValidationErrors('confirm_email');
        $this->withToken($token)->deleteJson('/api/account', ['confirm_email' => 'DEL@gmail.com'])->assertNoContent();
        $this->assertSame(0, User::where('email', 'del@gmail.com')->count());
    }

    public function test_linked_password_user_still_deletes_with_password(): void
    {
        $user = User::factory()->create(['email' => 'pw@example.com', 'password' => 'matkhau123']);
        $this->fakeGoogleUser('g-pw', 'pw@example.com');
        $q = $this->hitCallback();
        $token = $this->postJson('/api/auth/google/exchange', ['code' => $q['code']])
            ->assertJsonPath('user.has_password', true)->json('token');
        $this->withToken($token)->deleteJson('/api/account', ['confirm_email' => 'pw@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->withToken($token)->deleteJson('/api/account', ['password' => 'matkhau123'])->assertNoContent();
        $this->assertModelMissing($user);
    }
}
