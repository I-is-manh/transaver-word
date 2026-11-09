<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bộ từ người dùng tự tạo trên web app (không có tag, không có deck tự động).
        Schema::create('decks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('color', 7)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'name']);
        });

        Schema::create('deck_words', function (Blueprint $table) {
            $table->foreignId('deck_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_word_id')->constrained()->cascadeOnDelete();
            $table->timestamp('added_at')->useCurrent();
            $table->primary(['deck_id', 'user_word_id']);
            $table->index('user_word_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deck_words');
        Schema::dropIfExists('decks');
    }
};
