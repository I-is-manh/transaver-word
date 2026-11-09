<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Words\UpdateContextRequest;
use App\Http\Resources\ContextResource;
use App\Http\Resources\WordResource;
use App\Models\UserWord;
use App\Models\WordContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Ngữ cảnh của một từ (contract mục 3.9). Từ đang ở thùng rác: phải khôi phục trước (404). */
class WordContextController extends Controller
{
    public function update(UpdateContextRequest $request, int $word, int $context): JsonResponse
    {
        [$model, $ctx] = $this->findOwned($request, $word, $context);

        $ctx->fill($request->validated())->save();

        if ($model->meaning === null && $ctx->meaning !== null) {
            $model->meaning = $ctx->meaning;
            $model->save();
        }

        return response()->json([
            'word' => new WordResource($model->load(['dictionaryEntry', 'decks'])->loadCount('contexts')),
            'context' => new ContextResource($ctx),
        ]);
    }

    public function destroy(Request $request, int $word, int $context): Response
    {
        DB::transaction(function () use ($request, $word, $context) {
            [$model, $ctx] = $this->findOwned($request, $word, $context, lock: true);

            if ($model->contexts()->count() <= 1) {
                throw ValidationException::withMessages(['context' => __('words.last_context')]);
            }

            $ctx->delete();
        });

        return response()->noContent();
    }

    /** @return array{0: UserWord, 1: WordContext} */
    private function findOwned(Request $request, int $wordId, int $contextId, bool $lock = false): array
    {
        $model = UserWord::ownedBy($request->user())
            ->when($lock, fn ($q) => $q->lockForUpdate())
            ->findOrFail($wordId);
        $ctx = $model->contexts()->findOrFail($contextId);

        return [$model, $ctx];
    }
}
