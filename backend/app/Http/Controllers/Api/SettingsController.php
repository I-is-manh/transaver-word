<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\OnboardingRequest;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\UserSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Cài đặt và onboarding (contract mục 6.1, 6.2). */
class SettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['settings' => self::present($request->user())]);
    }

    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        DB::transaction(function () use ($user, $data) {
            if (array_key_exists('timezone', $data)) {
                $user->forceFill(['timezone' => $data['timezone']])->save();
                unset($data['timezone']);
            }

            if (array_key_exists('exercise_types', $data)) {
                // flashcard luôn bật, không tắt được.
                $data['exercise_types'] = array_values(array_unique(array_merge(['flashcard'], $data['exercise_types'])));
            }
            if (array_key_exists('reminder_channels', $data)) {
                $data['reminder_channels'] = array_values(array_unique($data['reminder_channels']));
            }
            if (array_key_exists('card_display', $data)) {
                $data['card_display'] = array_merge(UserSettings::get($user, 'card_display'), $data['card_display']);
            }
            if (array_key_exists('desired_retention', $data)) {
                $data['desired_retention'] = round((float) $data['desired_retention'], 2);
            }

            UserSettings::put($user, $data, 'user');
        });

        return response()->json(['settings' => self::present($user->fresh())]);
    }

    /**
     * Onboarding: quy đổi 3 câu trả lời thành cài đặt. Không đè cài đặt người dùng đã tự đặt.
     */
    public function onboarding(OnboardingRequest $request): JsonResponse
    {
        $user = $request->user();
        $answers = $request->validated();

        $values = [
            'daily_new_words' => [5 => 3, 10 => 7, 20 => 15][(int) $answers['daily_minutes']],
            'exercise_types' => $answers['level'] === 'beginner' ? ['flashcard', 'mcq'] : ['flashcard', 'mcq', 'cloze'],
            'desired_retention' => $answers['goal'] === 'exam' ? 0.92 : 0.9,
        ];

        DB::transaction(function () use ($user, $answers, $values) {
            UserSettings::put($user, $values, 'onboarding', onlyIfSourceIn: ['default', 'onboarding']);
            UserSettings::put($user, ['onboarding' => [
                'goal' => $answers['goal'], 'level' => $answers['level'], 'daily_minutes' => (int) $answers['daily_minutes'],
            ]], 'onboarding');

            if ($user->onboarding_completed_at === null) {
                $user->forceFill(['onboarding_completed_at' => now()])->save();
            }
        });

        $user = $user->fresh();

        return response()->json([
            'user' => new UserResource($user),
            'settings' => self::present($user),
        ]);
    }

    /** @return array<string, mixed> object Settings (giá trị phẳng, không có source) */
    public static function present(User $user): array
    {
        $values = UserSettings::values($user);

        return [
            'timezone' => $user->timezone,
            'daily_new_words' => (int) $values['daily_new_words'],
            'reminder_time' => $values['reminder_time'],
            'reminder_channels' => array_values($values['reminder_channels']),
            'exercise_types' => array_values($values['exercise_types']),
            'save_page_url' => (bool) $values['save_page_url'],
            'daily_review_limit' => (int) $values['daily_review_limit'],
            'desired_retention' => (float) $values['desired_retention'],
            'card_display' => [
                'phonetic' => (bool) $values['card_display']['phonetic'],
                'english_definition' => (bool) $values['card_display']['english_definition'],
                'context_sentence' => (bool) $values['card_display']['context_sentence'],
            ],
            'weekly_report' => (bool) $values['weekly_report'],
            // User cũ chưa có khóa này hoặc giá trị lạ → "system" (contract mục 6.4).
            'appearance' => in_array($values['appearance'], ['system', 'light', 'dark'], true) ? $values['appearance'] : 'system',
        ];
    }
}
