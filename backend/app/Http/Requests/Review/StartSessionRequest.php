<?php

namespace App\Http\Requests\Review;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** POST /api/review/sessions (contract mục 5.3) */
class StartSessionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::in(['daily', 'hard', 'deck'])],
            'deck_id' => ['nullable', 'required_if:mode,deck', 'integer'],
        ];
    }
}
