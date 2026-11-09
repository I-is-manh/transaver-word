<?php

namespace App\Actions;

use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Gửi email xác nhận (contract mục 2.7). Link là URL có chữ ký của backend, hết hạn sau
 * config('learning.email_verify_hours') giờ, không cần đăng nhập khi bấm (có thể mở trên máy khác).
 */
class SendVerificationEmail
{
    public function handle(User $user): bool
    {
        $hours = (int) config('learning.email_verify_hours', 24);
        $url = URL::temporarySignedRoute('verification.verify', now()->addHours($hours), [
            'id' => $user->id,
            'hash' => sha1(mb_strtolower($user->email)),
        ]);

        try {
            // Chỉ đưa vào hàng đợi (nhanh); queue worker do scheduler chạy mỗi phút sẽ gửi qua SMTP.
            Mail::to($user->email)->queue(new VerifyEmailMail($user, $url, $hours));

            return true;
        } catch (Throwable $e) {
            // Không đưa được vào hàng đợi: không làm hỏng đăng ký; người dùng bấm "Gửi lại email".
            Log::warning('Verification email failed', ['user_id' => $user->id, 'message' => $e->getMessage()]);

            return false;
        }
    }
}
