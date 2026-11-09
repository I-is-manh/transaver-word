<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique()->comment('Luôn lưu chữ thường');
            $table->string('name')->nullable();
            $table->string('password');
            $table->string('avatar_url', 500)->nullable();
            $table->string('google_id', 64)->nullable()->unique()->comment('Để sẵn cho đăng nhập Google sau này');
            $table->string('timezone', 64)->default('Asia/Ho_Chi_Minh')->comment('Tên IANA, dùng tính ngày học, streak, giờ nhắc');
            $table->enum('role', ['user', 'admin'])->default('user');
            $table->enum('status', ['active', 'banned'])->default('active');
            $table->timestamp('onboarding_completed_at')->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        // Chặn trùng email không phân biệt hoa thường ngay trong database (app vẫn lưu chữ thường).
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(email))');
        }

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
    }
};
