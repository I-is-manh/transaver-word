<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Decks\DeckWordsRequest;
use App\Http\Requests\Decks\SaveDeckRequest;
use App\Models\Deck;
use App\Models\User;
use App\Services\ProgressService;
use App\Support\ApiDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/** Deck (contract mục 7). Deck của người khác → 404. */
class DeckController extends Controller
{
    public function __construct(private readonly ProgressService $progress) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $decks = Deck::where('user_id', $user->id)->orderByRaw('LOWER(name)')->orderBy('id')->get();

        return response()->json(['data' => $decks->map(fn (Deck $d) => $this->present($user, $d))->all()]);
    }

    public function store(SaveDeckRequest $request): JsonResponse
    {
        $deck = Deck::create($request->validated() + ['user_id' => $request->user()->id]);

        return response()->json(['deck' => $this->present($request->user(), $deck)], 201);
    }

    public function update(SaveDeckRequest $request, int $deck): JsonResponse
    {
        $model = $this->find($request, $deck);
        $model->fill($request->validated())->save();

        return response()->json(['deck' => $this->present($request->user(), $model)]);
    }

    /** Xóa deck. Từ trong deck vẫn giữ (chỉ xóa liên kết). */
    public function destroy(Request $request, int $deck): Response
    {
        $this->find($request, $deck)->delete();

        return response()->noContent();
    }

    public function addWords(DeckWordsRequest $request, int $deck): JsonResponse
    {
        $model = $this->find($request, $deck);
        $now = now();

        DB::table('deck_words')->insertOrIgnore(array_map(fn ($id) => [
            'deck_id' => $model->id, 'user_word_id' => (int) $id, 'added_at' => $now,
        ], $request->validated('word_ids')));

        return response()->json(['deck' => $this->present($request->user(), $model)]);
    }

    public function removeWords(Request $request, int $deck): JsonResponse
    {
        $model = $this->find($request, $deck);
        $data = $request->validate([
            'word_ids' => ['required', 'array', 'min:1', 'max:200'],
            'word_ids.*' => ['integer'],
        ]);

        DB::table('deck_words')->where('deck_id', $model->id)->whereIn('user_word_id', $data['word_ids'])->delete();

        return response()->json(['deck' => $this->present($request->user(), $model)]);
    }

    private function find(Request $request, int $id): Deck
    {
        return Deck::where('user_id', $request->user()->id)->findOrFail($id);
    }

    /** @return array<string, mixed> object Deck */
    private function present(User $user, Deck $deck): array
    {
        return [
            'id' => $deck->id,
            'name' => $deck->name,
            'color' => $deck->color,
            'words_count' => $deck->words()->whereNull('user_words.deleted_at')->count(),
            'due_count' => $this->progress->dueCount($user, $deck->id),
            'created_at' => ApiDate::format($deck->created_at),
        ];
    }
}
