<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Vai trò superadmin và đăng nhập với tư cách người khác (contract mục 9.1).
 */
return new class extends Migration
{
    public function up(): void
    {
        // users.role thêm 'superadmin'
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'superadmin'))");

        // Token impersonate ghi người đang impersonate. Xóa superadmin thì xóa luôn token impersonate
        // (nếu chỉ đặt NULL, token sẽ biến thành token đăng nhập bình thường của người bị impersonate).
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->foreignId('impersonator_id')->nullable()->after('tokenable_id')->constrained('users')->cascadeOnDelete();
        });

        Schema::create('impersonation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('impersonator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('token_id')->nullable()->constrained('personal_access_tokens')->nullOnDelete();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('impersonation_logs');
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('impersonator_id');
        });
        DB::table('users')->where('role', 'superadmin')->update(['role' => 'admin']);
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))");
    }
};
