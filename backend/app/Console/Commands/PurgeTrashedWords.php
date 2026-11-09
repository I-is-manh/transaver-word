<?php

namespace App\Console\Commands;

use App\Models\UserWord;
use Illuminate\Console\Command;

/** Xóa hẳn các từ nằm trong thùng rác quá learning.trash_days ngày (contract mục 3.8). */
class PurgeTrashedWords extends Command
{
    protected $signature = 'words:purge-trash';

    protected $description = 'Xóa hẳn các từ đã ở thùng rác quá số ngày cho phép';

    public function handle(): int
    {
        $days = (int) config('learning.trash_days');
        $cutoff = now()->subDays($days);
        $total = 0;

        UserWord::onlyTrashed()
            ->where('deleted_at', '<', $cutoff)
            ->chunkById(500, function ($words) use (&$total) {
                $ids = $words->modelKeys();
                // Ngữ cảnh, lịch sử ôn, liên kết deck tự xóa theo nhờ ON DELETE CASCADE.
                $total += UserWord::onlyTrashed()->whereKey($ids)->forceDelete();
            });

        $this->info("Đã xóa hẳn {$total} từ (trong thùng rác quá {$days} ngày).");

        return self::SUCCESS;
    }
}
