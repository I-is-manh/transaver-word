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

/** Email báo cáo tuần (contract mục 8.2). Ghi nhận năng lực, không so sánh với người khác. */
class WeeklyReportMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    private const LOG_TYPE = 'weekly_report';

    /** Số lần thử và thời gian chờ giữa các lần (giây) khi SMTP lỗi. */
    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    /** @param array<string, mixed> $report */
    public function __construct(public readonly User $user, public readonly array $report, public readonly ?string $forDate = null) {}

    public function envelope(): Envelope
    {
        $n = (int) $this->report['newly_mastered'];

        return new Envelope(subject: $n > 0
            ? "Tuần này bạn thuộc thêm {$n} từ"
            : 'Nhìn lại tuần học của bạn');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.weekly-report',
            text: 'mail.weekly-report-text',
            with: ['statsUrl' => rtrim((string) config('app.frontend_url'), '/').'/stats'],
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
