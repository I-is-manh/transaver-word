<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Email nhắc học hằng ngày (contract mục 6.3). Lời nhắc nhẹ nhàng, không đe dọa. */
class DailyReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    private const LOG_TYPE = 'daily_reminder';

    /** Số lần thử và thời gian chờ giữa các lần (giây) khi SMTP lỗi. */
    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public readonly User $user, public readonly int $dueCount, public readonly ?string $forDate = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->dueCount > 0
            ? "Có {$this->dueCount} từ đang chờ bạn ôn hôm nay"
            : 'Dành vài phút ôn từ hôm nay nhé');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.daily-reminder',
            text: 'mail.daily-reminder-text',
            with: ['reviewUrl' => rtrim((string) config('app.frontend_url'), '/').'/review'],
        );
    }

    /** Gửi lỗi sau mọi lần thử của queue worker: ghi lại vào notification_logs. */
    public function failed(Throwable $e): void
    {
        if ($this->forDate === null) {
            return;
        }
        DB::table('notification_logs')
            ->where(['user_id' => $this->user->id, 'type' => self::LOG_TYPE, 'for_date' => $this->forDate])
            ->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 500)]);
    }
}
