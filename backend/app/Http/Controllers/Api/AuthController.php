<?php

namespace App\Http\Controllers\Api;

use App\Actions\CreateUser;
use App\Actions\SendVerificationEmail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** docs/api-contract.md mục 2 */
class AuthController extends Controller
{
    public function register(RegisterRequest $request, CreateUser $createUser): JsonResponse
    {
        $user = $createUser->handle($request->only(['email', 'password', 'timezone']));

        // Email xác nhận đi qua queue, nên đăng ký không phải chờ SMTP (mục 2.7).
        app(SendVerificationEmail::class)->handle($user);

        return $this->tokenResponse($user, $request->input('device_name'), 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = $request->authenticate();

        if ($user->status === User::STATUS_BANNED) {
            abort(403, __('auth.banned'));
        }

        return $this->tokenResponse($user, $request->input('device_name'), 200);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => new UserResource($request->user())]);
    }

    private function tokenResponse(User $user, ?string $deviceName, int $status): JsonResponse
    {
        $user->forceFill(['last_active_at' => now()])->save();
        $token = $user->createToken($deviceName ?: 'web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->refresh()),
        ], $status);
    }
}
