<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Các câu người dùng đã gặp từ đó. Dữ liệu cho bài điền chỗ trống bằng câu gốc.
        Schema::create('word_contexts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_word_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('sentence', 500);
            $table->char('sentence_hash', 64)->comment('SHA-256 của câu đã chuẩn hóa');
            $table->unsignedSmallInteger('word_offset')->nullable()->comment('Vị trí ký tự UTF-16 bắt đầu của từ trong câu');
            $table->unsignedSmallInteger('word_length')->nullable();
            $table->string('meaning', 500)->nullable()->comment('Nghĩa trong câu này');
            $table->enum('meaning_source', ['translation', 'dictionary', 'user', 'ai'])->nullable();
            $table->string('page_title', 500)->nullable();
            $table->text('page_url')->nullable();
            $table->timestamps();

            $table->unique(['user_word_id', 'sentence_hash']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('word_contexts');
    }
};
