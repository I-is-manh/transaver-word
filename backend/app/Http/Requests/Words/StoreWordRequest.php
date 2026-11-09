<?php

namespace App\Http\Requests\Words;

use Illuminate\Foundation\Http\FormRequest;

/** POST /api/words (contract mục 3.4) */
class StoreWordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:100'],
            'source_lang' => ['required', 'string', 'min:2', 'max:10', 'alpha_dash:ascii'],
            'target_lang' => ['required', 'string', 'min:2', 'max:10', 'alpha_dash:ascii'],
            'sentence' => ['required', 'string', 'max:500'],
            'word_offset' => ['nullable', 'integer', 'min:0', 'max:500'],
            'word_length' => ['nullable', 'integer', 'min:1', 'max:500'],
            'page_title' => ['nullable', 'string', 'max:500'],
            'page_url' => ['nullable', 'string', 'max:2048', 'url:http,https'],
            'translation' => ['nullable', 'string', 'max:500'],
        ];
    }
}
