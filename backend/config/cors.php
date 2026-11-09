<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Web app (Vite). Extension gọi API từ service worker nên không vướng CORS,
    // nhưng vẫn cho phép origin chrome-extension:// cho chắc.
    'allowed_origins' => array_filter(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))),

    // Môi trường local/testing: chấp nhận mọi cổng của localhost và 127.0.0.1 (Vite có thể đổi cổng khi 5173 bận).
    // Production chỉ dùng FRONTEND_URL ở trên.
    'allowed_origins_patterns' => array_values(array_filter([
        '#^chrome-extension://[a-p]{32}$#',
        in_array(env('APP_ENV'), ['local', 'testing'], true) ? '#^http://(localhost|127\.0\.0\.1)(:\d+)?$#' : null,
    ])),

    'allowed_headers' => ['*'],

    'exposed_headers' => ['Retry-After'],

    'max_age' => 0,

    'supports_credentials' => false,

];
