<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bảng trung tâm: mỗi dòng là một từ trong kho của một người, kèm trạng thái FSRS.
        // Xóa mềm (thùng rác). UNIQUE tính cả dòng trong thùng rác: lưu lại thì khôi phục dòng cũ.
        Schema::create('user_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dictionary_entry_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source_lang', 10);
            $table->string('target_lang', 10);
            $table->string('text', 100);
            $table->string('normalized_text', 100);
            $table->enum('kind', ['word', 'phrase'])->default('word');
            $table->string('meaning', 500)->nullable();
            $table->text('note')->nullable();
            $table->enum('status', ['learning', 'known'])->default('learning');
            // FSRS (tên theo ts-fsrs)
            $table->unsignedSmallInteger('fsrs_state')->default(0)->comment('0 New, 1 Learning, 2 Review, 3 Relearning');
            $table->timestamp('due_at')->nullable()->comment('NULL = chưa ôn lần nào');
            $table->double('stability')->default(0);
            $table->double('difficulty')->default(0);
            $table->unsignedInteger('elapsed_days')->default(0);
            $table->unsignedInteger('scheduled_days')->default(0);
            $table->unsignedInteger('reps')->default(0);
            $table->unsignedInteger('lapses')->default(0);
            $table->unsignedSmallInteger('learning_steps')->default(0)->comment('Bước học ngắn hạn hiện tại (ts-fsrs)');
            $table->timestamp('last_review_at')->nullable();
            $table->timestamp('first_mastered_at')->nullable()->comment('Lần đầu đạt "đã thuộc", để chỉ thưởng XP một lần');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['user_id', 'source_lang', 'target_lang', 'normalized_text']);
            $table->index(['user_id', 'status', 'due_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'lapses']);
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_words');
    }
};
