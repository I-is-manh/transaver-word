<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Review\AnswerRequest;
use App\Http\Requests\Review\StartSessionRequest;
use App\Models\Deck;
use App\Models\ReviewSession;
use App\Models\UserWord;
use App\Models\WordContext;
use App\Services\Review\ReviewService;
use App\Support\ApiDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Ôn tập (contract mục 5). */
class ReviewController extends Controller
{
    public function __construct(private readonly ReviewService $review) {}

    public function start(StartSessionRequest $request): JsonResponse
    {
        $user = $request->user();
        $mode = $request->validated('mode');
        $deckId = null;

        if ($mode === ReviewSession::MODE_DECK) {
            $deckId = Deck::where('user_id', $user->id)->findOrFail($request->validated('deck_id'))->id;
        }

        $result = $this->review->start($user, $mode, $deckId);
        $session = $result['session'];

        return response()->json([
            'session' => [
                'id' => $session->id,
                'mode' => $session->mode,
                'deck_id' => $session->deck_id,
                'started_at' => ApiDate::format($session->started_at),
            ],
            'cards' => $result['cards'],
            'overload' => $result['overload'],
        ], 201);
    }

    public function answer(AnswerRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $session = ReviewSession::where('user_id', $user->id)->findOrFail($data['session_id']);
        $word = UserWord::ownedBy($user)->findOrFail($data['user_word_id']);

        if (! empty($data['word_context_id'])
            && ! WordContext::where('user_word_id', $word->id)->whereKey($data['word_context_id'])->exists()) {
            throw ValidationException::withMessages(['word_context_id' => __('review.context_mismatch')]);
        }

        return response()->json($this->review->answer($user, $session, $word, $data));
    }

    public function finish(Request $request, int $session): JsonResponse
    {
        $model = ReviewSession::where('user_id', $request->user()->id)->findOrFail($session);

        return response()->json($this->review->finish($request->user(), $model));
    }
}
