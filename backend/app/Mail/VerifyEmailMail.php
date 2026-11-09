<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Email xác nhận địa chỉ email sau khi đăng ký (contract mục 2.7). */
class VerifyEmailMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public readonly User $user, public readonly string $verifyUrl, public readonly int $expireHours) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Xác nhận email cho tài khoản Transaver Word');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.verify-email', text: 'mail.verify-email-text');
    }
}
