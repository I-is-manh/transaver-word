<?php

namespace App\Http\Requests\Words;

use Illuminate\Validation\Rule;

/** GET /api/words/groups (contract mục 3.11): cùng bộ lọc với GET /words, thêm by và order. */
class GroupWordsRequest extends ListWordsRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'by' => ['required', Rule::in(['day', 'month', 'year'])],
            'order' => ['nullable', Rule::in(['desc', 'asc'])],
        ]);
    }

    public function messages(): array
    {
        return array_merge(parent::messages(), [
            'by.required' => 'Hãy chọn cách nhóm: ngày, tháng hoặc năm.',
            'by.in' => 'Cách nhóm phải là ngày (day), tháng (month) hoặc năm (year).',
        ]);
    }
}
