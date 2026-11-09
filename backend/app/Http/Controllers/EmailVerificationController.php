<?php

namespace App\Http\Controllers;

use App\Actions\SendVerificationEmail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/** Xác minh email (contract mục 2.7). */
class EmailVerificationController extends Controller
{
    /** GET /email/verify/{id}/{hash} (URL có chữ ký, bấm từ email) → chuyển về web. */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        if (! $request->hasValidSignature()) {
            return $this->toFrontend('expired');
        }

        $user = User::find($id);
        if (! $user || ! hash_equals(sha1(mb_strtolower($user->email)), $hash)) {
            return $this->toFrontend('invalid');
        }
        if ($user->email_verified_at !== null) {
            return $this->toFrontend('already');
        }

        $user->forceFill(['email_verified_at' => now()])->save();

        return $this->toFrontend('success');
    }

    /** POST /api/email/verification-notification 🔒: gửi lại email, tối đa 1 lần mỗi phút. */
    public function resend(Request $request, SendVerificationEmail $send): JsonResponse
    {
        $user = $request->user();
        if ($user->email_verified_at !== null) {
            return response()->json(['message' => __('auth.email_already_verified'), 'sent' => false]);
        }

        $key = 'verify-email:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 1)) {
            $seconds = RateLimiter::availableIn($key);

            return response()->json(['message' => __('auth.email_resend_throttle', ['seconds' => $seconds])], 429)
                ->header('Retry-After', (string) $seconds);
        }
        RateLimiter::hit($key, 60);

        if (! $send->handle($user)) {
            return response()->json(['message' => __('auth.email_send_failed')], 503);
        }

        return response()->json(['message' => __('auth.email_resent', ['email' => $user->email]), 'sent' => true], 202);
    }

    private function toFrontend(string $status): RedirectResponse
    {
        return redirect()->away(rtrim((string) config('app.frontend_url'), '/').'/email-verified?status='.$status);
    }
}
