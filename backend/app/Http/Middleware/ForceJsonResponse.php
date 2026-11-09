<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Với /api/*: luôn trả JSON (kể cả lỗi, dù client quên gửi Accept) và giữ nguyên chữ UTF-8
 * (không đổi tiếng Việt thành \uXXXX). Đăng ký là middleware toàn cục để áp dụng cả cho
 * lỗi xảy ra trước khi khớp route (404 route không tồn tại).
 */
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('api/*')) {
            return $next($request);
        }

        $request->headers->set('Accept', 'application/json');

        $response = $next($request);

        if ($response instanceof JsonResponse) {
            $response->setEncodingOptions($response->getEncodingOptions() | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return $response;
    }
}
