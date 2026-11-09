<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/** Nâng một tài khoản có sẵn thành superadmin (contract mục 9.1). */
class MakeSuperAdmin extends Command
{
    protected $signature = 'user:superadmin {email : Email của tài khoản cần nâng quyền}';

    protected $description = 'Nâng một tài khoản có sẵn thành superadmin';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();

        if ($user === null) {
            $this->error("Không tìm thấy tài khoản {$email}.");

            return self::FAILURE;
        }

        if ($user->isSuperAdmin()) {
            $this->info("{$email} đã là superadmin.");

            return self::SUCCESS;
        }

        $user->forceFill(['role' => User::ROLE_SUPERADMIN])->save();
        $this->info("Đã nâng {$email} thành superadmin.");

        return self::SUCCESS;
    }
}
