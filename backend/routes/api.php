<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeckController;
use App\Http\Controllers\Api\DictionaryController;
use App\Http\Controllers\Api\ImpersonationController;
use App\Http\Controllers\Api\MotivationController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\WordContextController;
use App\Http\Controllers\Api\WordController;
use App\Http\Controllers\Api\WordGroupController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\GoogleAuthController;
use Illuminate\Support\Facades\Route;

// docs/api-contract.md

Route::get('/health', fn () => response()->json(['ok' => true]));

// Đăng nhập Google: GET /auth/google/redirect và /auth/google/callback nằm ở routes/web.php (mục 2.6).
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/google/exchange', [GoogleAuthController::class, 'exchange'])->middleware('throttle:20,1');
    // Đang impersonate thì dùng /impersonation/stop thay cho logout (contract mục 9.1).
    Route::post('/logout', [AuthController::class, 'logout'])->middleware(['auth:sanctum', 'active', 'not_impersonating']);
});

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])->middleware('not_impersonating');

    // Từ vựng (mục 3)
    Route::get('/words', [WordController::class, 'index']);
    Route::post('/words', [WordController::class, 'store']);
    Route::get('/words/trash', [WordController::class, 'trash']);
    Route::get('/words/languages', [WordGroupController::class, 'languages']);
    Route::get('/words/groups', [WordGroupController::class, 'groups']);
    Route::get('/words/highlight-list', [MotivationController::class, 'highlightList']);
    Route::get('/words/{word}', [WordController::class, 'show'])->whereNumber('word');
    Route::patch('/words/{word}', [WordController::class, 'update'])->whereNumber('word');
    Route::delete('/words/{word}', [WordController::class, 'destroy'])->whereNumber('word');
    Route::post('/words/{word}/restore', [WordController::class, 'restore'])->whereNumber('word');
    Route::delete('/words/{word}/force', [WordController::class, 'forceDestroy'])->whereNumber('word');
    Route::get('/words/{word}/meaning-candidates', [WordController::class, 'meaningCandidates'])->whereNumber('word');
    Route::patch('/words/{word}/contexts/{context}', [WordContextController::class, 'update'])->whereNumber(['word', 'context']);
    Route::delete('/words/{word}/contexts/{context}', [WordContextController::class, 'destroy'])->whereNumber(['word', 'context']);

    // Từ điển (mục 4)
    Route::get('/dictionary/lookup', [DictionaryController::class, 'lookup']);

    // Ôn tập (mục 5)
    Route::post('/review/sessions', [ReviewController::class, 'start']);
    Route::post('/review/answer', [ReviewController::class, 'answer']);
    Route::post('/review/sessions/{session}/finish', [ReviewController::class, 'finish'])->whereNumber('session');

    // Cài đặt, onboarding, thống kê, tài khoản (mục 6)
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::patch('/settings', [SettingsController::class, 'update']);
    Route::post('/onboarding', [SettingsController::class, 'onboarding']);
    Route::get('/stats/summary', [StatsController::class, 'summary']);
    Route::get('/today', [StatsController::class, 'today']);
    Route::delete('/account', [AccountController::class, 'destroy'])->middleware('not_impersonating');
    Route::post('/impersonation/stop', [ImpersonationController::class, 'stop']);

    // Deck (mục 7)
    Route::get('/decks', [DeckController::class, 'index']);
    Route::post('/decks', [DeckController::class, 'store']);
    Route::patch('/decks/{deck}', [DeckController::class, 'update'])->whereNumber('deck');
    Route::delete('/decks/{deck}', [DeckController::class, 'destroy'])->whereNumber('deck');
    Route::post('/decks/{deck}/words', [DeckController::class, 'addWords'])->whereNumber('deck');
    Route::delete('/decks/{deck}/words', [DeckController::class, 'removeWords'])->whereNumber('deck');

    // Động lực và thống kê (mục 8)
    Route::get('/achievements', [MotivationController::class, 'achievements']);
    Route::get('/reports/weekly', [MotivationController::class, 'weekly']);
    Route::get('/stats/heatmap', [MotivationController::class, 'heatmap']);
    Route::get('/stats/progress', [MotivationController::class, 'progress']);
});

// Admin (mục 9)
// not_impersonating đứng trước admin: đang impersonate thì mọi /admin/* trả 403 với câu riêng.
Route::middleware(['auth:sanctum', 'active', 'not_impersonating', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{user}', [AdminController::class, 'update'])->whereNumber('user');

    // Superadmin (mục 9.1)
    Route::middleware('superadmin')->group(function () {
        Route::post('/users/{user}/impersonate', [ImpersonationController::class, 'start'])->whereNumber('user');
        Route::get('/impersonations', [ImpersonationController::class, 'logs']);
    });
});
