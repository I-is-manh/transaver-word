<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use App\Models\UserWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Trang admin cơ bản (contract mục 9). */
class AdminController extends Controller
{
    public function stats(): JsonResponse
    {
        $sevenDaysAgo = now()->subDays(7);

        return response()->json([
            'users_total' => User::count(),
            // Có lượt ôn hoặc lưu từ trong 7 ngày gần nhất.
            'users_active_7d' => DB::table('daily_activity')
                ->where('activity_date', '>=', now()->subDays(6)->toDateString())
                ->where(fn ($q) => $q->where('reviews_count', '>', 0)->orWhere('words_saved', '>', 0))
                ->distinct()->count('user_id'),
            'words_total' => UserWord::count(),
            'reviews_today' => DB::table('review_logs')->where('reviewed_at', '>=', now()->startOfDay())->count(),
            'reviews_7d' => DB::table('review_logs')->where('reviewed_at', '>=', $sevenDaysAgo)->count(),
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $page = $this->usersQuery()
            ->when($data['q'] ?? null, fn ($q, $s) => $q->where('users.email', 'like', '%'.addcslashes(mb_strtolower(trim($s)), '\\%_').'%'))
            ->orderByDesc('users.id')
            ->paginate((int) ($data['per_page'] ?? 20))
            ->withQueryString();

        return AdminUserResource::collection($page)->response();
    }

    public function update(Request $request, int $user): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in([User::STATUS_ACTIVE, User::STATUS_BANNED])],
            'role' => ['sometimes', Rule::in(User::ROLES)],
        ]);
        $target = User::findOrFail($user);
        $me = $request->user();

        // Chỉ superadmin sửa được tài khoản superadmin hoặc gán quyền superadmin (contract mục 9.1).
        if (! $me->isSuperAdmin() && ($target->isSuperAdmin() || ($data['role'] ?? null) === User::ROLE_SUPERADMIN)) {
            abort(403, __('admin.superadmin_only'));
        }

        if ($target->id === $me->id) {
            if (($data['status'] ?? null) === User::STATUS_BANNED) {
                throw ValidationException::withMessages(['status' => __('admin.cannot_ban_self')]);
            }
            $rank = array_flip(User::ROLES);
            if (isset($data['role']) && $rank[$data['role']] < $rank[$me->role]) {
                throw ValidationException::withMessages(['role' => __('admin.cannot_demote_self')]);
            }
        }

        DB::transaction(function () use ($target, $data) {
            $target->forceFill($data)->save();
            if ($target->status === User::STATUS_BANNED) {
                $target->tokens()->delete(); // khóa thì thu hồi mọi token
            }
        });

        return response()->json(['user' => new AdminUserResource($this->usersQuery()->findOrFail($target->id))]);
    }

    private function usersQuery()
    {
        return User::query()
            ->select('users.*')
            ->selectSub(UserWord::selectRaw('COUNT(*)')->whereColumn('user_words.user_id', 'users.id'), 'words_count')
            ->selectSub(DB::table('user_progress')->select('last_active_date')->whereColumn('user_progress.user_id', 'users.id'), 'last_active_date');
    }
}
