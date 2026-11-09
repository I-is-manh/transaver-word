<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/** DELETE /api/account (contract mục 6.2): xóa tài khoản và toàn bộ dữ liệu. */
class AccountController extends Controller
{
    public function destroy(Request $request): Response
    {
        $user = $request->user();

        if ($user->password !== null) {
            $request->validate(['password' => ['required', 'string']]);
            if (! Hash::check($request->input('password'), $user->password)) {
                throw ValidationException::withMessages(['password' => __('auth.password')]);
            }
        } else {
            // Tài khoản Google không có mật khẩu: xác nhận bằng cách gõ lại email.
            $request->validate(['confirm_email' => ['required', 'string']]);
            if (mb_strtolower(trim($request->input('confirm_email'))) !== mb_strtolower($user->email)) {
                throw ValidationException::withMessages(['confirm_email' => __('auth.confirm_email')]);
            }
        }

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            // Mọi bảng của người dùng có ON DELETE CASCADE từ users.
            $user->delete();
        });

        return response()->noContent();
    }
}
