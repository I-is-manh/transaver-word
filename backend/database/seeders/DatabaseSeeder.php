<?php

namespace Database\Seeders;

use App\Actions\CreateUser;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Tài khoản mẫu cho môi trường local. Mật khẩu: password123.
     */
    public function run(CreateUser $createUser): void
    {
        $this->call(AchievementSeeder::class);

        $accounts = [
            ['email' => 'demo@transaver.local', 'name' => 'Demo', 'role' => User::ROLE_USER],
            ['email' => 'admin@transaver.local', 'name' => 'Admin', 'role' => User::ROLE_ADMIN],
        ];

        $this->call(SuperAdminSeeder::class);

        foreach ($accounts as $account) {
            if (User::where('email', $account['email'])->exists()) {
                continue;
            }

            $createUser->handle($account + [
                'password' => 'password123',
                'timezone' => 'Asia/Ho_Chi_Minh',
                'email_verified_at' => now(),
            ]);
        }
    }
}
