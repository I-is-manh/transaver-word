<?php

namespace App\Http\Requests\Words;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** PATCH /api/words/{id} (contract mục 3.7) */
class UpdateWordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'text' => ['sometimes', 'required', 'string', 'min:1', 'max:100'],
            'meaning' => ['sometimes', 'nullable', 'string', 'max:500'],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(['learning', 'known'])],
            'kind' => ['sometimes', Rule::in(['word', 'phrase'])],
        ];
    }
}
