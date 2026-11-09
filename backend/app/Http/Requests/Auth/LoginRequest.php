<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** docs/api-contract.md mục 2.3 */
class LoginRequest extends FormRequest
{
    /** Số lần sai tối đa mỗi phút cho một cặp email + IP. */
    public const MAX_ATTEMPTS = 5;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', Rule::in(['web', 'extension'])],
        ];
    }

    /**
     * Kiểm tra email và mật khẩu. Sai thì 422 ở errors.email, không tiết lộ email có tồn tại hay không.
     *
     * @throws ValidationException|ThrottleRequestsException
     */
    public function authenticate(): User
    {
        $key = $this->throttleKey();

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            throw new ThrottleRequestsException(
                __('auth.throttle', ['seconds' => $seconds]),
                null,
                ['Retry-After' => $seconds],
            );
        }

        $user = User::where('email', $this->input('email'))->first();

        if (! $user || ! Hash::check($this->input('password'), $user->password)) {
            RateLimiter::hit($key, 60);

            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        RateLimiter::clear($key);

        return $user;
    }

    private function throttleKey(): string
    {
        return 'login:'.$this->input('email').'|'.$this->ip();
    }
}
