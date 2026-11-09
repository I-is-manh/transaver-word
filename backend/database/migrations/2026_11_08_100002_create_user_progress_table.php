<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tóm tắt streak và XP để trang chủ đọc nhanh. Cấp độ tính ra từ total_xp.
        Schema::create('user_progress', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('current_streak')->default(0);
            $table->unsignedInteger('longest_streak')->default(0);
            $table->date('last_active_date')->nullable()->comment('Theo múi giờ người dùng');
            $table->unsignedSmallInteger('freezes_available')->default(0);
            $table->unsignedInteger('total_xp')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_progress');
    }
};
