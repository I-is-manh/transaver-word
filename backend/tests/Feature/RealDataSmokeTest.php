<?php

namespace Tests\Feature;

use App\Models\Deck;
use App\Models\User;
use App\Models\UserWord;
use Database\Seeders\AchievementSeeder;
use Database\Seeders\DemoDataSeeder;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Lưới an toàn cho lỗi chỉ xuất hiện khi có dữ liệu thật: nạp DemoDataSeeder rồi gọi các endpoint chính,
 * không được có lỗi 5xx.
 */
class RealDataSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_main_endpoints_with_demo_data_have_no_server_errors(): void
    {
        $this->seed(AchievementSeeder::class);
        $this->seed(DemoDataSeeder::class);
        $this->seed(SuperAdminSeeder::class);

        $demo = User::where('email', 'demo@transaver.local')->firstOrFail();
        $this->actingAs($demo, 'sanctum');

        $wordId = $demo->id ? UserWord::where('user_id', $demo->id)->value('id') : null;
        $deckId = Deck::where('user_id', $demo->id)->value('id');

        $gets = [
            '/api/me', '/api/settings', '/api/today', '/api/stats/summary',
            '/api/words', '/api/words?sort=due_at', '/api/words?sort=text&q=a', '/api/words?hard=1', "/api/words?deck_id={$deckId}",
            '/api/words?status=known', '/api/words?kind=phrase', '/api/words/trash', '/api/words/highlight-list',
            "/api/words/{$wordId}", "/api/words/{$wordId}/meaning-candidates",
            '/api/decks', '/api/achievements', '/api/reports/weekly', '/api/stats/heatmap', '/api/stats/progress?days=60',
        ];
        foreach ($gets as $url) {
            $res = $this->getJson($url);
            $this->assertLessThan(500, $res->status(), "{$url}: ".$res->getContent());
            $res->assertOk();
        }

        // Tạo buổi ôn mọi mode, trả lời vài thẻ (có gửi câu đã dùng), kết thúc
        foreach ([['mode' => 'daily'], ['mode' => 'hard'], ['mode' => 'deck', 'deck_id' => $deckId]] as $body) {
            $res = $this->postJson('/api/review/sessions', $body);
            $this->assertLessThan(500, $res->status(), json_encode($body).': '.$res->getContent());
            $res->assertCreated();

            foreach (array_slice($res->json('cards'), 0, 3) as $card) {
                $this->postJson('/api/review/answer', [
                    'client_uuid' => (string) Str::uuid(),
                    'session_id' => $res->json('session.id'),
                    'user_word_id' => $card['word']['id'],
                    'exercise_type' => $card['exercise_type'],
                    'rating' => 3,
                    'is_correct' => $card['exercise_type'] === 'flashcard' ? null : true,
                    'answer' => $card['answer_text'],
                    'word_context_id' => $card['context']['id'] ?? null,
                ])->assertOk();
            }
            $this->postJson('/api/review/sessions/'.$res->json('session.id').'/finish')->assertOk();
        }

        // Admin và superadmin trên cùng dữ liệu
        $this->actingAs(User::where('email', 'superadmin@transaver.local')->firstOrFail(), 'sanctum');
        foreach (['/api/admin/stats', '/api/admin/users', '/api/admin/users?q=demo', '/api/admin/impersonations'] as $url) {
            $this->getJson($url)->assertOk();
        }
    }
}
