<?php

namespace App\Http\Resources;

use App\Models\UserWord;
use App\Support\ApiDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Object Word (contract mục 3.1). Cần load sẵn dictionaryEntry và contexts_count để tránh N+1.
 *
 * @mixin UserWord
 */
class WordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $entry = $this->dictionaryEntry?->found ? $this->dictionaryEntry : null;

        return [
            'id' => $this->id,
            'text' => $this->text,
            'normalized_text' => $this->normalized_text,
            'kind' => $this->kind,
            'source_lang' => $this->source_lang,
            'target_lang' => $this->target_lang,
            'meaning' => $this->meaning,
            'note' => $this->note,
            'phonetic' => $entry?->phonetic,
            'audio_url' => $entry?->audio_url,
            'part_of_speech' => $entry?->firstPartOfSpeech(),
            'status' => $this->status,
            'fsrs_state' => $this->fsrs_state,
            'due_at' => ApiDate::format($this->due_at),
            'is_mastered' => $this->isMastered(),
            'lapses' => $this->lapses,
            'contexts_count' => (int) ($this->contexts_count ?? $this->contexts()->count()),
            'deck_ids' => $this->decks->pluck('id')->sort()->values()->all(),
            // Ngày lưu theo múi giờ của người dùng (contract mục 3.11): web gom nhóm theo trường này.
            'saved_date' => $this->created_at?->copy()->setTimezone($request->user()?->timezone ?: config('learning.default_timezone'))->toDateString(),
            'created_at' => ApiDate::format($this->created_at),
            'updated_at' => ApiDate::format($this->updated_at),
            'deleted_at' => ApiDate::format($this->deleted_at),
        ];
    }
}
