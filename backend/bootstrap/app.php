<?php

use App\Http\Middleware\EnsureNotImpersonating;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsSuperAdmin;
use App\Http\Middleware\ForceJsonResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(ForceJsonResponse::class);
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'admin' => EnsureUserIsAdmin::class,
            'superadmin' => EnsureUserIsSuperAdmin::class,
            'not_impersonating' => EnsureNotImpersonating::class,
        ]);

        // API không có trang đăng nhập để chuyển hướng: trả 401 JSON.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Lỗi trong API luôn là JSON, câu thông báo tiếng Việt (docs/api-contract.md mục 1.4).
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => __('auth.unauthenticated')], 401);
            }
        });

        // 404 của route model binding mặc định lộ tên model ("No query results for model ..."): thay bằng câu chung.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => __('http.404')], 404);
            }
        });

        // Các lỗi HTTP khác không có câu riêng thì dùng câu mặc định tiếng Việt theo mã lỗi.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            $status = $e->getStatusCode();
            $message = $e->getMessage();
            if ($message === '' || ! preg_match('/[^\x00-\x7F]/', $message)) {
                // Câu rỗng hoặc câu tiếng Anh mặc định của framework.
                $key = 'http.'.$status;
                $message = trans()->has($key) ? __($key) : __('http.default');
            }

            return response()->json(['message' => $message], $status, $e->getHeaders());
        });
    })->create();
