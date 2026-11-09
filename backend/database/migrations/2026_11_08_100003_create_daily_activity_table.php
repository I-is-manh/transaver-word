<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Một dòng cho mỗi người mỗi ngày có hoạt động (ngày theo múi giờ người dùng).
        Schema::create('daily_activity', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('activity_date');
            $table->unsignedInteger('reviews_count')->default(0);
            $table->unsignedInteger('new_words_learned')->default(0);
            $table->unsignedInteger('words_saved')->default(0);
            $table->unsignedInteger('study_seconds')->default(0);
            $table->boolean('goal_met')->default(false);
            $table->boolean('freeze_used')->default(false);
            $table->unsignedInteger('xp_earned')->default(0);
            $table->timestamps();
            $table->primary(['user_id', 'activity_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_activity');
    }
};
