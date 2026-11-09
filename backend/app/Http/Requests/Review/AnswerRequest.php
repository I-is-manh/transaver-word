<?php

namespace App\Http\Requests\Review;

use App\Services\Review\CardBuilder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** POST /api/review/answer (contract mục 5.4) */
class AnswerRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'session_id' => ['required', 'integer'],
            'user_word_id' => ['required', 'integer'],
            'exercise_type' => ['required', Rule::in(CardBuilder::TYPES)],
            'rating' => ['required', 'integer', 'between:1,4'],
            'is_correct' => ['nullable', 'boolean'],
            'answer' => ['nullable', 'string', 'max:255'],
            'word_context_id' => ['nullable', 'integer'],
        ];
    }
}
