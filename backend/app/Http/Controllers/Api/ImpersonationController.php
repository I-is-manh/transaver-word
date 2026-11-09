<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ApiDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/** Superadmin đăng nhập với tư cách người khác (contract mục 9.1). */
class ImpersonationController extends Controller
{
    public const TOKEN_NAME = 'impersonation';

    /** POST /api/admin/users/{id}/impersonate (superadmin, không lồng). */
    public function start(Request $request, int $user): JsonResponse
    {
        $me = $request->user();
        $target = User::findOrFail($user);

        if ($target->id === $me->id) {
            throw ValidationException::withMessages(['user' => __('admin.impersonate_self')]);
        }
        if ($target->isSuperAdmin()) {
            throw ValidationException::withMessages(['user' => __('admin.impersonate_superadmin')]);
        }
        if ($target->status === User::STATUS_BANNED) {
            throw ValidationException::withMessages(['user' => __('admin.impersonate_banned')]);
        }

        $expiresAt = now()->addMinutes((int) config('learning.impersonation_minutes'));

        $plain = DB::transaction(function () use ($request, $me, $target, $expiresAt) {
            $new = $target->createToken(self::TOKEN_NAME, ['*'], $expiresAt);
            $new->accessToken->forceFill(['impersonator_id' => $me->id])->save();

            DB::table('impersonation_logs')->insert([
                'impersonator_id' => $me->id,
                'user_id' => $target->id,
                'token_id' => $new->accessToken->id,
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
                'started_at' => now(),
            ]);

            return $new->plainTextToken;
        });

        return response()->json([
            'token' => $plain,
            'user' => (new UserResource($target))->impersonatedBy($me),
            'expires_at' => ApiDate::format($expiresAt),
        ], 201);
    }

    /** POST /api/impersonation/stop: thu hồi token impersonate hiện tại. */
    public function stop(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();

        if (! $token instanceof PersonalAccessToken || $token->impersonator_id === null) {
            throw ValidationException::withMessages(['token' => __('admin.not_impersonating')]);
        }

        DB::transaction(function () use ($token) {
            DB::table('impersonation_logs')->where('token_id', $token->id)->whereNull('ended_at')->update(['ended_at' => now()]);
            $token->delete();
        });

        return response()->noContent();
    }

    /** GET /api/admin/impersonations (superadmin): nhật ký, mới nhất trước. */
    public function logs(Request $request): JsonResponse
    {
        $data = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $page = DB::table('impersonation_logs as l')
            ->leftJoin('users as i', 'i.id', '=', 'l.impersonator_id')
            ->leftJoin('users as u', 'u.id', '=', 'l.user_id')
            ->orderByDesc('l.started_at')->orderByDesc('l.id')
            ->select('l.id', 'i.email as impersonator_email', 'u.email as user_email', 'l.started_at', 'l.ended_at')
            ->paginate((int) ($data['per_page'] ?? 20))
            ->withQueryString();

        $page->getCollection()->transform(fn ($r) => [
            'id' => $r->id,
            'impersonator_email' => $r->impersonator_email,
            'user_email' => $r->user_email,
            'started_at' => ApiDate::format($r->started_at ? Carbon::parse($r->started_at) : null),
            'ended_at' => ApiDate::format($r->ended_at ? Carbon::parse($r->ended_at) : null),
        ]);

        // Định dạng phân trang chung (contract mục 1.5): data, links, meta
        return response()->json([
            'data' => $page->items(),
            'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()), 'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()],
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }
}
