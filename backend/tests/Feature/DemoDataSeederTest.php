<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserWord;
use Database\Seeders\AchievementSeeder;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Seeder dữ liệu demo: chạy được, không gọi mạng, chạy lại cho cùng kết quả. */
class DemoDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seeder_builds_consistent_data_and_is_rerunnable(): void
    {
        $this->seed(AchievementSeeder::class);
        $this->seed(DemoDataSeeder::class);
        $first = $this->snapshot();
        $this->seed(DemoDataSeeder::class);

        $this->assertSame($first, $this->snapshot());
        $this->assertSame(60, $first['words']);
        $this->assertSame(3, $first['trashed']);
        $this->assertSame(2, $first['decks']);
        $this->assertGreaterThanOrEqual(1, $first['hard']);
        $this->assertGreaterThanOrEqual(5, $first['mastered']);
        $this->assertGreaterThan(7, $first['streak']);
        $this->assertGreaterThanOrEqual(12, $first['hosts']);
        $this->assertContains('streak_7', $first['achievements']);
        Http::assertNothingSent();

        $user = User::where('email', 'demo@transaver.local')->firstOrFail();
        $this->actingAs($user, 'sanctum');
        $this->getJson('/api/stats/summary')->assertOk()->assertJsonPath('saved_count', 57);
        $this->assertNotEmpty($this->getJson('/api/stats/heatmap')->json('days'));
        $this->postJson('/api/review/sessions', ['mode' => 'daily'])->assertCreated();
    }

    private function snapshot(): array
    {
        $user = User::where('email', 'demo@transaver.local')->firstOrFail();
        $words = UserWord::withTrashed()->where('user_id', $user->id);

        return [
            'words' => (clone $words)->count(),
            'trashed' => (clone $words)->whereNotNull('deleted_at')->count(),
            'hard' => (clone $words)->whereNull('deleted_at')->where('status', 'learning')->where('lapses', '>=', 3)->count(),
            'mastered' => (clone $words)->where('fsrs_state', 2)->where('stability', '>=', 21)->count(),
            'decks' => DB::table('decks')->where('user_id', $user->id)->count(),
            'logs' => DB::table('review_logs')->where('user_id', $user->id)->count(),
            'streak' => (int) DB::table('user_progress')->where('user_id', $user->id)->value('current_streak'),
            'xp' => (int) DB::table('user_progress')->where('user_id', $user->id)->value('total_xp'),
            'hosts' => (int) DB::table('word_contexts')->where('user_id', $user->id)
                ->selectRaw("COUNT(DISTINCT SUBSTRING(page_url FROM '^https?://(?:www\\.)?([^/:?#]+)')) AS n")->value('n'),
            'achievements' => DB::table('user_achievements')->join('achievements', 'achievements.id', '=', 'achievement_id')
                ->where('user_id', $user->id)->orderBy('code')->pluck('code')->all(),
        ];
    }
}
