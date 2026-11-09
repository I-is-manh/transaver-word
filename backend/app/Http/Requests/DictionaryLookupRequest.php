<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** GET /api/dictionary/lookup (contract mục 4.1) */
class DictionaryLookupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:100'],
            'lang' => ['required', 'string', 'min:2', 'max:10', 'alpha_dash:ascii'],
        ];
    }
}
