<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Nghĩa theo ngữ cảnh bằng AI (chủ sản phẩm tự cắm). Xem app/Contracts/ContextMeaningService.php.
    // AI_PROVIDER để trống → không gọi AI (NullContextMeaningService).
    'ai' => [
        'provider' => env('AI_PROVIDER'),
        'api_key' => env('AI_API_KEY'),
        'model' => env('AI_MODEL'),
        // Tên provider => class implement App\Contracts\ContextMeaningService. Ví dụ:
        // 'anthropic' => App\Services\Ai\AnthropicContextMeaningService::class,
        'providers' => [],
    ],

    // Đăng nhập Google (App\Http\Controllers\GoogleAuthController). GOOGLE_REDIRECT_URI phải trùng
    // "Authorized redirect URIs" trong Google Cloud Console, ví dụ http://localhost:8000/auth/google/callback.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
