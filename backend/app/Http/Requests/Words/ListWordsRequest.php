<?php

namespace App\Http\Requests\Words;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** GET /api/words và GET /api/words/trash (contract mục 3.5, 3.8) */
class ListWordsRequest extends FormRequest
{
    public const SORTS = ['-created_at', 'created_at', 'text', 'due_at'];

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['learning', 'known'])],
            'kind' => ['nullable', Rule::in(['word', 'phrase'])],
            'sort' => ['nullable', Rule::in(self::SORTS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'deck_id' => ['nullable', 'integer'],
            'hard' => ['nullable', 'boolean'],
            'lang' => ['nullable', 'string', 'max:10', 'regex:/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/'],
            'saved_from' => ['nullable', 'date_format:Y-m-d'],
            'saved_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:saved_from'],
        ];
    }

    public function messages(): array
    {
        return [
            'lang.regex' => 'Mã ngôn ngữ không hợp lệ.',
            'saved_to.after_or_equal' => 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
        ];
    }

    /** @return array<string, mixed> các bộ lọc dùng chung (App\Queries\WordFilters) */
    public function filters(): array
    {
        return array_intersect_key($this->validated(), array_flip(['q', 'status', 'kind', 'hard', 'deck_id', 'lang', 'saved_from', 'saved_to']));
    }

    public function perPage(): int
    {
        return (int) ($this->validated('per_page') ?? 20);
    }
}
