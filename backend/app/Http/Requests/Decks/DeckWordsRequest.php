<?php

namespace App\Http\Requests\Decks;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** POST/DELETE /api/decks/{id}/words (contract mục 7) */
class DeckWordsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'word_ids' => ['required', 'array', 'min:1', 'max:200'],
            'word_ids.*' => ['integer', 'distinct',
                // Chỉ từ của chính người dùng (không tính từ trong thùng rác).
                Rule::exists('user_words', 'id')->where('user_id', $this->user()->id)->whereNull('deleted_at')],
        ];
    }

    public function messages(): array
    {
        return ['word_ids.*.exists' => 'Có từ không tồn tại trong kho của bạn.'];
    }
}
