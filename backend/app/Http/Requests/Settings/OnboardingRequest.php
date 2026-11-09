<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** POST /api/onboarding (contract mục 6.2) */
class OnboardingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'goal' => ['required', Rule::in(['exam', 'work', 'travel', 'hobby'])],
            'level' => ['required', Rule::in(['beginner', 'intermediate', 'advanced'])],
            'daily_minutes' => ['required', 'integer', Rule::in([5, 10, 20])],
        ];
    }
}
