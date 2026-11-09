<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/** docs/api-contract.md mục 1.4, 1.7, 2 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function registerPayload(array $overrides = []): array
    {
        return array_merge([
            'email' => 'manh@example.com',
            'password' => 'matkhau123',
            'password_confirmation' => 'matkhau123',
            'timezone' => 'Asia/Ho_Chi_Minh',
            'device_name' => 'web',
        ], $overrides);
    }

    public function test_health(): void
    {
        $this->getJson('/api/health')->assertOk()->assertExactJson(['ok' => true]);
    }

    public function test_register_creates_user_settings_progress_and_returns_token(): void
    {
        $response = $this->postJson('/api/auth/register', $this->registerPayload(['email' => '  Manh@Example.COM ']));

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'name', 'role', 'timezone', 'onboarding_completed', 'created_at']])
            ->assertJsonPath('user.email', 'manh@example.com')
            ->assertJsonPath('user.name', null)
            ->assertJsonPath('user.role', 'user')
            ->assertJsonPath('user.timezone', 'Asia/Ho_Chi_Minh')
            ->assertJsonPath('user.onboarding_completed', false);

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $response->json('user.created_at'));

        $user = User::where('email', 'manh@example.com')->firstOrFail();
        $this->assertDatabaseHas('user_settings', ['user_id' => $user->id, 'schema_version' => 1]);
        $this->assertDatabaseHas('user_progress', ['user_id' => $user->id, 'current_streak' => 0]);
        $this->assertSame(7, $user->settings->settings['daily_new_words']['value']);

        // Token dùng được ngay
        $this->withToken($response->json('token'))->getJson('/api/me')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_register_without_timezone_uses_default(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload(['timezone' => null]))
            ->assertCreated()
            ->assertJsonPath('user.timezone', 'Asia/Ho_Chi_Minh');
    }

    public function test_register_rejects_invalid_timezone(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload(['timezone' => 'Mars/Olympus']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['timezone']);
    }

    public function test_register_rejects_duplicate_email_case_insensitive(): void
    {
        User::factory()->create(['email' => 'manh@example.com']);

        $this->postJson('/api/auth/register', $this->registerPayload(['email' => 'MANH@example.com']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'Email đã được sử dụng.')
            ->assertJsonPath('message', 'Email đã được sử dụng.');

        $this->assertSame(1, User::count());
    }

    public function test_register_rejects_password_mismatch(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload(['password_confirmation' => 'khac12345']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password'])
            ->assertJsonPath('errors.password.0', 'Mật khẩu nhập lại không khớp.');
    }

    public function test_register_rejects_short_password(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload(['password' => 'ngan123', 'password_confirmation' => 'ngan123']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password'])
            ->assertJsonPath('errors.password.0', 'Mật khẩu phải có ít nhất 8 ký tự.');
    }

    public function test_register_rejects_invalid_email(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload(['email' => 'khong-phai-email']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Email không đúng định dạng email.');
    }

    public function test_login_returns_token(): void
    {
        $user = User::factory()->create(['email' => 'manh@example.com']);

        $this->postJson('/api/auth/login', ['email' => 'Manh@example.com', 'password' => 'password123', 'device_name' => 'extension'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email']])
            ->assertJsonPath('user.id', $user->id);

        $this->assertSame('extension', PersonalAccessToken::firstOrFail()->name);
    }

    public function test_login_with_wrong_password_returns_422_on_email(): void
    {
        User::factory()->create(['email' => 'manh@example.com']);

        $this->postJson('/api/auth/login', ['email' => 'manh@example.com', 'password' => 'sai-mat-khau'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Email hoặc mật khẩu không đúng.')
            ->assertJsonMissingPath('errors.password');
    }

    public function test_login_with_unknown_email_gives_same_error(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'khongco@example.com', 'password' => 'password123'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Email hoặc mật khẩu không đúng.');
    }

    public function test_login_is_throttled_after_5_failures(): void
    {
        User::factory()->create(['email' => 'manh@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'manh@example.com', 'password' => 'sai-mat-khau'])->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', ['email' => 'manh@example.com', 'password' => 'password123'])
            ->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertJsonStructure(['message']);
    }

    public function test_banned_user_cannot_login(): void
    {
        User::factory()->banned()->create(['email' => 'manh@example.com']);

        $this->postJson('/api/auth/login', ['email' => 'manh@example.com', 'password' => 'password123'])
            ->assertForbidden()
            ->assertJsonPath('message', 'Tài khoản này đã bị khóa.');
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();

        $this->assertSame(0, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_me_without_token_returns_401_json(): void
    {
        $this->getJson('/api/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.');
    }

    public function test_me_without_accept_header_still_returns_401_json_not_redirect(): void
    {
        $this->get('/api/me')->assertUnauthorized()->assertJsonStructure(['message']);
    }

    public function test_unknown_api_route_returns_404_json_in_vietnamese(): void
    {
        $this->getJson('/api/khong-co')->assertNotFound()->assertExactJson(['message' => 'Không tìm thấy.']);
    }

    public function test_validation_summary_message_is_vietnamese(): void
    {
        $this->postJson('/api/auth/register', ['email' => 'khong-phai-email', 'password' => 'ngan'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Email không đúng định dạng email. (và 2 lỗi khác)');

        $this->postJson('/api/auth/register', [])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Vui lòng nhập email. (và 1 lỗi khác)');
    }

    public function test_json_is_raw_utf8_not_escaped(): void
    {
        $content = $this->getJson('/api/me')->assertUnauthorized()->getContent();

        $this->assertStringContainsString('Bạn chưa đăng nhập', $content);
        $this->assertStringNotContainsString('\u', $content);
    }

    public function test_banned_user_old_token_gets_403_everywhere(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('web')->plainTextToken;
        $user->update(['status' => User::STATUS_BANNED]);

        $this->withToken($token)->getJson('/api/me')
            ->assertForbidden()
            ->assertJsonPath('message', 'Tài khoản này đã bị khóa.');
        $this->withToken($token)->getJson('/api/words')->assertForbidden();
    }

    public function test_cors_allows_any_localhost_port_outside_production(): void
    {
        foreach (['http://localhost:5180', 'http://127.0.0.1:4000', 'http://localhost'] as $origin) {
            $this->call('OPTIONS', '/api/auth/login', server: [
                'HTTP_ORIGIN' => $origin,
                'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
                'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
            ])->assertNoContent()->assertHeader('Access-Control-Allow-Origin', $origin);
        }

        $this->withHeaders(['Origin' => 'http://evil.example:5180'])->getJson('/api/health')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
        $this->withHeaders(['Origin' => 'http://localhost.evil.com'])->getJson('/api/health')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_cors_allows_web_app_origin(): void
    {
        $this->withHeaders(['Origin' => 'http://localhost:5173'])
            ->getJson('/api/health')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }
}
