<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Tài khoản bị khóa: mọi endpoint cần đăng nhập trả 403, kể cả khi token cũ vẫn còn (contract mục 2.3). */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $user->status === User::STATUS_BANNED) {
            abort(403, __('auth.banned'));
        }

        return $next($request);
    }
}
