<?php

namespace App\Http\Requests\Words;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** PATCH /api/words/{id}/contexts/{contextId} (contract mục 3.9) */
class UpdateContextRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'meaning' => ['present', 'nullable', 'string', 'max:500'],
            'meaning_source' => ['required', Rule::in(['dictionary', 'user', 'translation'])],
        ];
    }
}
