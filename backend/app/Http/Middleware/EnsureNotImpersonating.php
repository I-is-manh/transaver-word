<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Chặn hành động nhạy cảm khi đang đăng nhập với tư cách người khác (contract mục 9.1). */
class EnsureNotImpersonating
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_if($user instanceof User && $user->isImpersonated(), 403, __('admin.blocked_while_impersonating'));

        return $next($request);
    }
}
