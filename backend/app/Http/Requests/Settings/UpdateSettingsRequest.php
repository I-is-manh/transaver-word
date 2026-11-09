<?php

namespace App\Http\Requests\Settings;

use App\Services\Review\CardBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** PATCH /api/settings (contract mục 6.1, 6.2) */
class UpdateSettingsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'timezone' => ['sometimes', 'string', 'timezone:all'],
            'daily_new_words' => ['sometimes', 'integer', 'between:1,50'],
            'reminder_time' => ['sometimes', 'nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'reminder_channels' => ['sometimes', 'array'],
            'reminder_channels.*' => ['string', 'distinct', Rule::in(['browser', 'email'])],
            'exercise_types' => ['sometimes', 'array', 'min:1'],
            'exercise_types.*' => ['string', 'distinct', Rule::in(CardBuilder::TYPES)],
            'save_page_url' => ['sometimes', 'boolean'],
            'daily_review_limit' => ['sometimes', 'integer', 'between:20,500'],
            'desired_retention' => ['sometimes', 'numeric', 'between:0.8,0.97'],
            'card_display' => ['sometimes', 'array'],
            'card_display.phonetic' => ['sometimes', 'boolean'],
            'card_display.english_definition' => ['sometimes', 'boolean'],
            'card_display.context_sentence' => ['sometimes', 'boolean'],
            'weekly_report' => ['sometimes', 'boolean'],
            'appearance' => ['sometimes', 'string', Rule::in(['system', 'light', 'dark'])],
        ];
    }

    public function messages(): array
    {
        return ['reminder_time.regex' => 'Giờ nhắc phải có dạng HH:MM, ví dụ 21:30.'];
    }
}
