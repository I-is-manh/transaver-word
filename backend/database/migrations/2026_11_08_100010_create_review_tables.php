<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Mỗi lần mở buổi ôn là một dòng.
        Schema::create('review_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('mode', ['daily', 'extra', 'hard', 'deck'])->default('daily');
            $table->foreignId('deck_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable()->comment('NULL = bỏ dở');
            $table->unsignedInteger('cards_reviewed')->default(0);
            $table->unsignedInteger('new_cards')->default(0);
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->unsignedInteger('xp_earned')->default(0);
            $table->index(['user_id', 'started_at']);
        });

        // Mỗi lần trả lời một thẻ là một dòng. Chỉ thêm, không sửa. Server ghi sau khi tự tính FSRS.
        Schema::create('review_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->unique()->comment('Web app sinh, gửi lại không tính hai lần');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_word_id')->constrained()->cascadeOnDelete();
            $table->foreignId('session_id')->nullable()->constrained('review_sessions')->nullOnDelete();
            $table->foreignId('word_context_id')->nullable()->constrained()->nullOnDelete();
            $table->string('exercise_type', 20)->comment('flashcard, mcq, cloze, listening, dictation');
            $table->unsignedSmallInteger('rating')->comment('1 Again, 2 Hard, 3 Good, 4 Easy');
            $table->boolean('is_correct')->nullable();
            $table->string('answer')->nullable();
            $table->unsignedSmallInteger('state_before');
            $table->unsignedInteger('elapsed_days');
            $table->unsignedInteger('scheduled_days');
            $table->double('stability_after');
            $table->double('difficulty_after');
            $table->timestamp('due_after')->comment('Lần ôn tiếp theo');
            $table->unsignedInteger('xp_earned')->default(0);
            $table->boolean('became_mastered')->default(false);
            $table->timestamp('reviewed_at', 3)->comment('Giờ server');

            $table->index(['user_word_id', 'reviewed_at']);
            $table->index(['user_id', 'reviewed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_logs');
        Schema::dropIfExists('review_sessions');
    }
};
