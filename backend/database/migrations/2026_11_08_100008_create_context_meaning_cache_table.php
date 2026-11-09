<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Chỉ dùng khi bật AI: cùng từ trong cùng câu thì không gọi AI lần hai.
        Schema::create('context_meaning_cache', function (Blueprint $table) {
            $table->id();
            $table->char('cache_key', 64)->unique()->comment('SHA-256 của lang + từ + câu chuẩn hóa + target_lang');
            $table->text('meaning');
            $table->string('model', 50);
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('context_meaning_cache');
    }
};
