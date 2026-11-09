<?php

namespace Tests\Feature;

use App\Actions\CreateUser;
use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/** docs/api-contract.md mục 9.1: superadmin và đăng nhập với tư cách người khác */
class ImpersonationTest extends TestCase
{
    use RefreshDatabase;

    private const BLOCKED = 'Không thực hiện được khi đang đăng nhập với tư cách người khác.';

    private User $super;

    private User $admin;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-10 03:00:00');
        $make = fn (string $email, string $role) => app(CreateUser::class)->handle(['email' => $email, 'password' => 'password123', 'role' => $role]);
        $this->super = $make('super@example.com', User::ROLE_SUPERADMIN);
        $this->admin = $make('admin@example.com', User::ROLE_ADMIN);
        $this->user = $make('manh@example.com', User::ROLE_USER);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Gọi API bằng token thật (để kiểm tra đúng token impersonate). */
    private function as(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function tokenOf(User $u): string
    {
        return $u->createToken('web')->plainTextToken;
    }

    private function impersonate(User $target): TestResponse
    {
        return $this->as($this->tokenOf($this->super))->postJson("/api/admin/users/{$target->id}/impersonate");
    }

    // ---------- quyền ----------

    public function test_only_superadmin_can_impersonate(): void
    {
        $this->as($this->tokenOf($this->user))->postJson("/api/admin/users/{$this->admin->id}/impersonate")->assertForbidden();
        $this->as($this->tokenOf($this->admin))->postJson("/api/admin/users/{$this->user->id}/impersonate")->assertForbidden();
        $this->as($this->tokenOf($this->admin))->getJson('/api/admin/impersonations')->assertForbidden();
        $this->impersonate($this->user)->assertCreated();
    }

    public function test_superadmin_has_admin_rights(): void
    {
        $this->as($this->tokenOf($this->super))->getJson('/api/admin/stats')->assertOk();
        $this->as($this->tokenOf($this->super))->getJson('/api/admin/users')->assertOk()->assertJsonPath('meta.total', 3);
    }

    public function test_impersonate_returns_token_user_with_impersonator_and_expiry(): void
    {
        $res = $this->impersonate($this->user)->assertCreated()
            ->assertJsonPath('user.id', $this->user->id)
            ->assertJsonPath('user.impersonator', ['id' => $this->super->id, 'email' => 'super@example.com'])
            ->assertJsonPath('expires_at', '2026-11-10T05:00:00Z');

        $token = PersonalAccessToken::findToken($res->json('token'));
        $this->assertSame('impersonation', $token->name);
        $this->assertSame($this->super->id, $token->impersonator_id);
        $this->assertSame($this->user->id, $token->tokenable_id);

        // /me bằng token impersonate có impersonator; token thường thì null
        $this->as($res->json('token'))->getJson('/api/me')->assertOk()
            ->assertJsonPath('user.id', $this->user->id)
            ->assertJsonPath('user.impersonator.email', 'super@example.com');
        $this->as($this->tokenOf($this->user))->getJson('/api/me')->assertJsonPath('user.impersonator', null);
        $this->as($this->tokenOf($this->super))->getJson('/api/me')->assertJsonPath('user.role', 'superadmin');
    }

    public function test_impersonate_rules_422(): void
    {
        $other = app(CreateUser::class)->handle(['email' => 'super2@example.com', 'password' => 'password123', 'role' => User::ROLE_SUPERADMIN]);
        $banned = app(CreateUser::class)->handle(['email' => 'ban@example.com', 'password' => 'password123']);
        $banned->update(['status' => User::STATUS_BANNED]);

        $this->impersonate($this->super)->assertUnprocessable()
            ->assertJsonPath('errors.user.0', 'Bạn không thể đăng nhập với tư cách chính mình.');
        $this->impersonate($other)->assertUnprocessable()
            ->assertJsonPath('errors.user.0', 'Không thể đăng nhập với tư cách một superadmin khác.');
        $this->impersonate($banned)->assertUnprocessable()
            ->assertJsonPath('errors.user.0', 'Không thể đăng nhập với tư cách tài khoản đang bị khóa.');
        $this->as($this->tokenOf($this->super))->postJson('/api/admin/users/999999/impersonate')->assertNotFound();
        $this->assertSame(0, DB::table('impersonation_logs')->count());
    }

    public function test_no_nested_impersonation(): void
    {
        $token = $this->impersonate($this->admin)->json('token');

        // Đang là admin (qua impersonate) cũng không gọi được /admin/*
        $this->as($token)->postJson("/api/admin/users/{$this->user->id}/impersonate")
            ->assertForbidden()->assertJsonPath('message', self::BLOCKED);
    }

    // ---------- chặn khi đang impersonate ----------

    public function test_sensitive_actions_blocked_while_impersonating(): void
    {
        $token = $this->impersonate($this->admin)->json('token');

        $this->as($token)->deleteJson('/api/account', ['password' => 'password123'])->assertForbidden()->assertJsonPath('message', self::BLOCKED);
        $this->as($token)->postJson('/api/auth/logout')->assertForbidden()->assertJsonPath('message', self::BLOCKED);
        $this->as($token)->getJson('/api/admin/stats')->assertForbidden()->assertJsonPath('message', self::BLOCKED);
        $this->as($token)->getJson('/api/admin/users')->assertForbidden();

        // Hành động học bình thường vẫn được, ghi vào dữ liệu của người bị impersonate
        $this->as($token)->getJson('/api/settings')->assertOk();
        $this->as($token)->postJson('/api/decks', ['name' => 'Từ admin'])->assertCreated();
        $this->assertDatabaseHas('decks', ['user_id' => $this->admin->id, 'name' => 'Từ admin']);
        $this->assertNotNull(User::find($this->admin->id));
    }

    // ---------- dừng và hết hạn ----------

    public function test_stop_revokes_token_and_logs_end(): void
    {
        $token = $this->impersonate($this->user)->json('token');
        Carbon::setTestNow(now()->addMinutes(15));

        $this->as($token)->postJson('/api/impersonation/stop')->assertNoContent();
        $this->as($token)->getJson('/api/me')->assertUnauthorized();

        $log = DB::table('impersonation_logs')->first();
        $this->assertSame($this->super->id, $log->impersonator_id);
        $this->assertSame($this->user->id, $log->user_id);
        $this->assertSame('2026-11-10 03:15:00', Carbon::parse($log->ended_at)->toDateTimeString());

        // Token thường gọi stop → 422
        $this->as($this->tokenOf($this->user))->postJson('/api/impersonation/stop')->assertUnprocessable()
            ->assertJsonPath('errors.token.0', 'Bạn không đang đăng nhập với tư cách người khác.');
    }

    public function test_token_expires_after_configured_minutes(): void
    {
        $token = $this->impersonate($this->user)->json('token');

        Carbon::setTestNow(now()->addMinutes(119));
        $this->as($token)->getJson('/api/me')->assertOk();
        Carbon::setTestNow(now()->addMinutes(2));
        $this->as($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_deleting_superadmin_removes_impersonation_tokens(): void
    {
        $token = $this->impersonate($this->user)->json('token');
        $this->super->delete();

        $this->as($token)->getJson('/api/me')->assertUnauthorized();
        $this->assertNull(DB::table('impersonation_logs')->value('impersonator_id'));
    }

    // ---------- admin thường không đụng superadmin ----------

    public function test_admin_cannot_modify_or_create_superadmin(): void
    {
        $adminToken = $this->tokenOf($this->admin);

        $this->as($adminToken)->patchJson("/api/admin/users/{$this->super->id}", ['status' => 'banned'])->assertForbidden();
        $this->as($adminToken)->patchJson("/api/admin/users/{$this->super->id}", ['role' => 'user'])->assertForbidden();
        $this->as($adminToken)->patchJson("/api/admin/users/{$this->user->id}", ['role' => 'superadmin'])->assertForbidden()
            ->assertJsonPath('message', 'Chỉ superadmin mới thay đổi được tài khoản superadmin hoặc gán quyền superadmin.');
        $this->as($adminToken)->patchJson("/api/admin/users/{$this->user->id}", ['role' => 'admin'])->assertOk();

        $superToken = $this->tokenOf($this->super);
        $this->as($superToken)->patchJson("/api/admin/users/{$this->user->id}", ['role' => 'superadmin'])->assertOk()
            ->assertJsonPath('user.role', 'superadmin');
        $this->as($superToken)->patchJson("/api/admin/users/{$this->super->id}", ['role' => 'admin'])->assertUnprocessable()
            ->assertJsonPath('errors.role.0', 'Bạn không thể tự bỏ quyền admin của mình.');
        $this->as($superToken)->patchJson("/api/admin/users/{$this->super->id}", ['status' => 'banned'])->assertUnprocessable();
    }

    // ---------- nhật ký ----------

    public function test_impersonation_logs_newest_first(): void
    {
        $this->impersonate($this->user)->assertCreated();
        Carbon::setTestNow(now()->addHour());
        $this->impersonate($this->admin)->assertCreated();

        $this->as($this->tokenOf($this->super))->getJson('/api/admin/impersonations')->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.user_email', 'admin@example.com')
            ->assertJsonPath('data.0.impersonator_email', 'super@example.com')
            ->assertJsonPath('data.0.started_at', '2026-11-10T04:00:00Z')
            ->assertJsonPath('data.0.ended_at', null)
            ->assertJsonPath('data.1.user_email', 'manh@example.com')
            ->assertJsonStructure(['data' => [['id', 'impersonator_email', 'user_email', 'started_at', 'ended_at']], 'links', 'meta']);
    }

    // ---------- seeder, lệnh ----------

    public function test_superadmin_seeder_and_command(): void
    {
        $this->seed(SuperAdminSeeder::class);
        $this->seed(SuperAdminSeeder::class);
        $this->assertSame(1, User::where('email', 'superadmin@transaver.local')->count());
        $this->assertTrue(User::where('email', 'superadmin@transaver.local')->first()->isSuperAdmin());

        $this->artisan('user:superadmin', ['email' => 'MANH@example.com'])->assertSuccessful();
        $this->assertTrue($this->user->fresh()->isSuperAdmin());
        $this->artisan('user:superadmin', ['email' => 'khongco@example.com'])->assertFailed();
    }
}
