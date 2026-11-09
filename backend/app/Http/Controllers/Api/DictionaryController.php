<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DictionaryLookupRequest;
use App\Services\DictionaryService;
use Illuminate\Http\JsonResponse;

/** GET /api/dictionary/lookup (contract mục 4.1) */
class DictionaryController extends Controller
{
    public function lookup(DictionaryLookupRequest $request, DictionaryService $dictionary): JsonResponse
    {
        $entry = $dictionary->find($request->validated('text'), $request->validated('lang'));

        return response()->json([
            'entry' => $entry === null ? null : [
                'text' => $entry->text,
                'phonetic' => $entry->phonetic,
                'audio_url' => $entry->audio_url,
                'meanings' => array_map(fn (array $d) => [
                    'part_of_speech' => $d['part_of_speech'] ?? null,
                    'definition' => $d['definition'],
                    'example' => $d['example'] ?? null,
                ], $entry->definitions ?? []),
            ],
        ]);
    }
}
