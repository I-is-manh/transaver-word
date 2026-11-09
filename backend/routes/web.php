<?php

use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\GoogleAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Đăng nhập Google (docs/api-contract.md mục 2.6). Callback phải trùng GOOGLE_REDIRECT_URI.
Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->middleware('throttle:30,1');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->middleware('throttle:30,1');

// Xác minh email (contract mục 2.7): link có chữ ký trong email, không cần đăng nhập.
Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->whereNumber('id')->middleware('throttle:30,1')->name('verification.verify');
