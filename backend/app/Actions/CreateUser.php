<?php

namespace App\Actions;

use App\Models\User;
use App\Support\DefaultSettings;
use Illuminate\Support\Facades\DB;

/**
 * Tạo tài khoản kèm user_settings mặc định và user_progress. Dùng cho đăng ký và seeder.
 */
class CreateUser
{
    /**
     * @param  array{email: string, password: ?string, email_verified_at?: mixed, timezone?: string|null, name?: string|null, role?: string}  $data
     */
    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'email' => $data['email'],
                'password' => $data['password'],
                'name' => $data['name'] ?? null,
                'timezone' => $data['timezone'] ?? config('learning.default_timezone'),
                'role' => $data['role'] ?? User::ROLE_USER,
            ]);
            if (! empty($data['email_verified_at'])) {
                // Không nằm trong $fillable: chỉ seeder và luồng Google được đặt sẵn.
                $user->forceFill(['email_verified_at' => $data['email_verified_at']])->save();
            }

            $user->settings()->create([
                'settings' => DefaultSettings::make(),
                'schema_version' => DefaultSettings::SCHEMA_VERSION,
            ]);

            $user->progress()->create();

            return $user;
        });
    }
}
