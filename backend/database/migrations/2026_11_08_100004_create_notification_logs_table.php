<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nhật ký email đã gửi. UNIQUE chặn gửi trùng trong một ngày.
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['daily_reminder', 'weekly_report']);
            $table->date('for_date')->comment('Ngày theo múi giờ người dùng; báo cáo tuần là ngày đầu tuần');
            $table->enum('status', ['sent', 'failed', 'skipped']);
            $table->string('error', 500)->nullable();
            $table->timestamp('sent_at');
            $table->unique(['user_id', 'type', 'for_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
