<?php

namespace App\Http\Requests\Decks;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/** POST/PATCH /api/decks (contract mục 7) */
class SaveDeckRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim((string) preg_replace('/\s+/u', ' ', $this->input('name')))]);
        }
        if (is_string($this->input('color'))) {
            $this->merge(['color' => strtoupper($this->input('color'))]);
        }
    }

    public function rules(): array
    {
        $deckId = $this->route('deck');
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'min:1', 'max:100', function (string $attribute, mixed $value, \Closure $fail) use ($deckId) {
                // Tên deck không trùng trong cùng người dùng, không phân biệt hoa thường.
                $exists = DB::table('decks')
                    ->where('user_id', $this->user()->id)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower((string) $value)])
                    ->when($deckId, fn ($q) => $q->where('id', '!=', $deckId))
                    ->exists();
                if ($exists) {
                    $fail(__('validation.custom.deck_name_taken'));
                }
            }],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-F]{6}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'color.regex' => 'Màu phải có dạng #RRGGBB.',
        ];
    }
}
