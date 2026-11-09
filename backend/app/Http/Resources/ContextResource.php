<?php

namespace App\Http\Resources;

use App\Models\WordContext;
use App\Support\ApiDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Object Context (contract mục 3.2).
 *
 * @mixin WordContext
 */
class ContextResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sentence' => $this->sentence,
            'word_offset' => $this->word_offset,
            'word_length' => $this->word_length,
            'page_title' => $this->page_title,
            'page_url' => $this->page_url,
            'meaning' => $this->meaning,
            'meaning_source' => $this->meaning_source,
            'created_at' => ApiDate::format($this->created_at),
        ];
    }
}
