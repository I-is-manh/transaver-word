<?php

namespace App\Http\Controllers;

use App\Actions\CreateUser;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

/**
 * Đăng nhập bằng Google (docs/api-contract.md mục 2.6). Luồng redirect, Socialite stateless:
 *
 *   web  → GET  /auth/google/redirect            (backend chuyển sang Google)
 *   Google → GET /auth/google/callback?code=…    (GOOGLE_REDIRECT_URI, phải khai báo trong Google Cloud Console)
 *   backend → FRONTEND_URL/auth/google/callback?code=<mã một lần>   (hoặc ?error=<mã lỗi>)
 *   web  → POST /api/auth/google/exchange {code} → { token, user, created }
 *
 * Token Sanctum không bao giờ nằm trên URL: chỉ có mã một lần, sống 120 giây, dùng một lần.
 */
class GoogleAuthController extends Controller
{
    private const CACHE_PREFIX = 'google_login:';

    private const CODE_TTL_SECONDS = 120;

    public function redirect(): RedirectResponse
    {
        if (! config('services.google.client_id') || ! config('services.google.client_secret')) {
            return $this->toFrontend(['error' => 'not_configured']);
        }

        return Socialite::driver('google')->stateless()
            ->scopes(['openid', 'email', 'profile'])
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, CreateUser $createUser): RedirectResponse
    {
        if ($request->filled('error')) {
            // Người dùng bấm Hủy trên màn hình Google, hoặc Google từ chối.
            return $this->toFrontend(['error' => 'cancelled']);
        }

        try {
            $google = Socialite::driver('google')->stateless()->user();
        } catch (Throwable $e) {
            Log::warning('Google login failed', ['message' => $e->getMessage()]);

            return $this->toFrontend(['error' => 'failed']);
        }

        $email = mb_strtolower(trim((string) $google->getEmail()));
        $verified = (bool) ($google->user['email_verified'] ?? $google->user['verified_email'] ?? false);
        if ($email === '' || ! $verified) {
            return $this->toFrontend(['error' => 'email_unverified']);
        }

        $googleId = (string) $google->getId();
        $created = false;

        $user = User::where('google_id', $googleId)->first();
        if (! $user) {
            $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
            if ($user) {
                // Tài khoản email/mật khẩu có sẵn: Google đã xác minh email nên liên kết luôn.
                // Google đã xác minh email này nên đánh dấu luôn (mục 2.7).
                $user->forceFill([
                    'google_id' => $user->google_id ?? $googleId,
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();
            } else {
                $user = $createUser->handle([
                    'email' => $email,
                    // Không có mật khẩu: chỉ đăng nhập bằng Google (users.password nullable).
                    'password' => null,
                    'name' => $google->getName() ?: null,
                ]);
                $user->forceFill(['google_id' => $googleId, 'email_verified_at' => now()])->save();
                $created = true;
            }
        }

        if ($user->status === User::STATUS_BANNED) {
            return $this->toFrontend(['error' => 'banned']);
        }

        $code = Str::random(64);
        Cache::put(self::CACHE_PREFIX.hash('sha256', $code), [
            'user_id' => $user->id,
            'created' => $created,
        ], self::CODE_TTL_SECONDS);

        return $this->toFrontend(['code' => $code]);
    }

    /** POST /api/auth/google/exchange { code, timezone?, device_name? } */
    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'size:64'],
            'timezone' => ['nullable', 'string', 'timezone:all'],
            'device_name' => ['nullable', 'in:web,extension'],
        ]);

        $payload = Cache::pull(self::CACHE_PREFIX.hash('sha256', $data['code']));
        $user = $payload ? User::find($payload['user_id']) : null;
        if (! $user) {
            throw ValidationException::withMessages(['code' => __('auth.google_code_invalid')]);
        }
        if ($user->status === User::STATUS_BANNED) {
            abort(403, __('auth.banned'));
        }

        // Tài khoản vừa tạo qua Google: lấy múi giờ trình duyệt gửi lên.
        if ($payload['created'] && ! empty($data['timezone'])) {
            $user->forceFill(['timezone' => $data['timezone']])->save();
        }

        $user->forceFill(['last_active_at' => now()])->save();
        $token = $user->createToken($data['device_name'] ?? 'web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->refresh()),
            'created' => (bool) $payload['created'],
        ]);
    }

    /** @param  array<string, string>  $query */
    private function toFrontend(array $query): RedirectResponse
    {
        $base = rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');

        return redirect()->away($base.'/auth/google/callback?'.http_build_query($query));
    }
}
