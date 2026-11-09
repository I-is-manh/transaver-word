<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Dùng chung cho mọi người. Lưu cả khi không tìm thấy (found = false) để không gọi API lại.
        Schema::create('dictionary_entries', function (Blueprint $table) {
            $table->id();
            $table->string('lang', 10);
            $table->string('text');
            $table->string('normalized_text');
            $table->boolean('found')->default(false);
            $table->string('phonetic')->nullable();
            $table->string('audio_url', 500)->nullable();
            $table->jsonb('parts_of_speech')->nullable();
            $table->jsonb('definitions')->nullable()->comment('[{part_of_speech, definition, example}]');
            $table->string('provider', 50);
            $table->timestamp('fetched_at');
            $table->timestamps();
            $table->unique(['lang', 'normalized_text']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dictionary_entries');
    }
};
