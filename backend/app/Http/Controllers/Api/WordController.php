<?php

namespace App\Http\Controllers\Api;

use App\Actions\SaveWord;
use App\Actions\UpdateWord;
use App\Http\Controllers\Controller;
use App\Http\Requests\Words\ListWordsRequest;
use App\Http\Requests\Words\StoreWordRequest;
use App\Http\Requests\Words\UpdateWordRequest;
use App\Http\Resources\ContextResource;
use App\Http\Resources\WordResource;
use App\Models\Deck;
use App\Models\UserWord;
use App\Queries\WordFilters;
use App\Services\AchievementService;
use App\Services\DictionaryService;
use App\Services\MeaningCandidates;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Từ vựng và thùng rác (contract mục 3.4–3.8, 3.10). */
class WordController extends Controller
{
    public function store(StoreWordRequest $request, SaveWord $saveWord, AchievementService $achievements): JsonResponse
    {
        $result = $saveWord->handle($request->user(), $request->validated());

        return response()->json([
            'word' => new WordResource($result['word']),
            'context' => new ContextResource($result['context']),
            'word_created' => $result['word_created'],
            'context_created' => $result['context_created'],
            'meaning_candidates' => $result['meaning_candidates'],
            'new_achievements' => $achievements->check($request->user(), AchievementService::EVENT_WORD_SAVED),
        ], $result['word_created'] ? 201 : 200);
    }

    public function index(ListWordsRequest $request): AnonymousResourceCollection
    {
        $query = WordFilters::apply($this->baseQuery($request), $request->user(), $request->filters());

        match ($request->validated('sort') ?? '-created_at') {
            'created_at' => $query->orderBy('created_at')->orderBy('id'),
            'text' => $query->orderBy('normalized_text')->orderBy('id'),
            'due_at' => $query->orderByRaw('due_at ASC NULLS LAST')->orderBy('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };

        return WordResource::collection($query->paginate($request->perPage())->withQueryString());
    }

    public function trash(ListWordsRequest $request): AnonymousResourceCollection
    {
        $query = WordFilters::apply($this->baseQuery($request, onlyTrashed: true), $request->user(), ['q' => $request->validated('q')])
            ->orderByDesc('deleted_at')
            ->orderByDesc('id');

        return WordResource::collection($query->paginate($request->perPage())->withQueryString());
    }

    public function show(Request $request, int $word): JsonResponse
    {
        $model = $this->findOwned($request, $word, withTrashed: true);
        $contexts = $model->contexts()->orderByDesc('created_at')->orderByDesc('id')->get();

        return response()->json([
            'word' => new WordResource($model),
            'contexts' => ContextResource::collection($contexts),
        ]);
    }

    public function update(UpdateWordRequest $request, int $word, UpdateWord $updateWord): JsonResponse
    {
        $model = $updateWord->handle($request->user(), $this->findOwned($request, $word), $request->validated());

        return response()->json(['word' => new WordResource($this->reload($model))]);
    }

    /** Xóa mềm: vào thùng rác. Từ đã ở thùng rác thì vẫn 204. */
    public function destroy(Request $request, int $word): Response
    {
        $model = $this->findOwned($request, $word, withTrashed: true);
        if (! $model->trashed()) {
            $model->delete();
        }

        return response()->noContent();
    }

    public function restore(Request $request, int $word): JsonResponse
    {
        $model = $this->findOwned($request, $word, withTrashed: true);
        if ($model->trashed()) {
            $model->restore();
        }

        return response()->json(['word' => new WordResource($this->reload($model))]);
    }

    /** Xóa hẳn: chỉ khi từ đang ở thùng rác. Ngữ cảnh, lịch sử ôn và liên kết deck mất theo (cascade). */
    public function forceDestroy(Request $request, int $word): Response
    {
        $model = $this->findOwned($request, $word, withTrashed: true);
        abort_unless($model->trashed(), 409, __('words.force_requires_trash'));

        $model->forceDelete();

        return response()->noContent();
    }

    public function meaningCandidates(Request $request, int $word, DictionaryService $dictionary, MeaningCandidates $candidates): JsonResponse
    {
        $model = $this->findOwned($request, $word, withTrashed: true);
        $entry = $model->dictionaryEntry ?? $dictionary->lookup($model->normalized_text, $model->source_lang);

        if ($entry?->found && $model->dictionary_entry_id === null) {
            $model->dictionaryEntry()->associate($entry)->save();
        }

        return response()->json([
            'meaning_candidates' => $candidates->build($model->meaning, $entry, 'current'),
        ]);
    }

    /** Truy vấn từ của người dùng, kèm quan hệ cần cho WordResource. */
    private function baseQuery(Request $request, bool $onlyTrashed = false): Builder
    {
        return ($onlyTrashed ? UserWord::onlyTrashed() : UserWord::query())
            ->ownedBy($request->user())
            ->with(['dictionaryEntry', 'decks'])
            ->withCount('contexts');
    }

    /** Từ của người khác hoặc không tồn tại → 404. */
    private function findOwned(Request $request, int $id, bool $withTrashed = false): UserWord
    {
        $query = $withTrashed ? UserWord::withTrashed() : UserWord::query();

        return $query->ownedBy($request->user())->with(['dictionaryEntry', 'decks'])->withCount('contexts')->findOrFail($id);
    }

    private function reload(UserWord $word): UserWord
    {
        return $word->load(['dictionaryEntry', 'decks'])->loadCount('contexts');
    }
}
