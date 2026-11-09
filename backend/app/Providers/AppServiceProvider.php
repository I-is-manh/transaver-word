<?php

namespace App\Providers;

use App\Contracts\ContextMeaningService;
use App\Services\Ai\NullContextMeaningService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Chọn provider AI theo config('services.ai.provider'). Rỗng hoặc không khai báo → không gọi AI.
        $this->app->bind(ContextMeaningService::class, function ($app) {
            $name = (string) config('services.ai.provider');
            $class = config("services.ai.providers.{$name}");

            if ($name === '') {
                return new NullContextMeaningService;
            }
            if (! is_string($class) || ! class_exists($class)) {
                Log::warning("AI_PROVIDER={$name} chưa được khai báo trong config/services.php → ai.providers. Tạm tắt AI.");

                return new NullContextMeaningService;
            }

            return $app->make($class);
        });
    }

    public function boot(): void
    {
        //
    }
}
