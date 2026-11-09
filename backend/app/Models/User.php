<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\PersonalAccessToken;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_USER = 'user';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_SUPERADMIN = 'superadmin';

    public const ROLES = [self::ROLE_USER, self::ROLE_ADMIN, self::ROLE_SUPERADMIN];

    public const STATUS_ACTIVE = 'active';

    public const STATUS_BANNED = 'banned';

    /** @var list<string> */
    protected $fillable = [
        'email',
        'name',
        'password',
        'timezone',
        'role',
        'status',
        'onboarding_completed_at',
        'last_active_at',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** @var array<string, mixed> */
    protected $attributes = [
        'role' => self::ROLE_USER,
        'status' => self::STATUS_ACTIVE,
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'onboarding_completed_at' => 'datetime',
            'last_active_at' => 'datetime',
        ];
    }

    /** Email luôn lưu chữ thường, để unique không phân biệt hoa thường. */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value) => mb_strtolower(trim($value)));
    }

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }

    public function progress(): HasOne
    {
        return $this->hasOne(UserProgress::class);
    }

    /** Admin hoặc superadmin (superadmin có mọi quyền của admin). */
    public function isAdmin(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_SUPERADMIN], true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPERADMIN;
    }

    /** Người đang "đăng nhập với tư cách" tài khoản này qua token hiện tại, nếu có. */
    public function impersonator(): ?self
    {
        $token = $this->currentAccessToken();
        $id = $token instanceof PersonalAccessToken ? $token->impersonator_id : null;

        return $id ? self::find($id) : null;
    }

    public function isImpersonated(): bool
    {
        $token = $this->currentAccessToken();

        return $token instanceof PersonalAccessToken && $token->impersonator_id !== null;
    }
}
