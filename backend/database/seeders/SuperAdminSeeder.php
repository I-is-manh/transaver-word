<?php

namespace Database\Seeders;

use App\Actions\CreateUser;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Tài khoản superadmin cho môi trường local: superadmin@transaver.local / password123.
 * Chạy được trên DB đang có dữ liệu: php artisan db:seed --class=SuperAdminSeeder (không tạo trùng).
 */
class SuperAdminSeeder extends Seeder
{
    public const EMAIL = 'superadmin@transaver.local';

    public function run(CreateUser $createUser): void
    {
        $user = User::where('email', self::EMAIL)->first();

        if ($user === null) {
            $createUser->handle([
                'email' => self::EMAIL, 'name' => 'Superadmin', 'password' => 'password123',
                'timezone' => 'Asia/Ho_Chi_Minh', 'role' => User::ROLE_SUPERADMIN,
                'email_verified_at' => now(),
            ]);

            return;
        }

        $user->forceFill(['role' => User::ROLE_SUPERADMIN, 'status' => User::STATUS_ACTIVE])->save();
    }
}
