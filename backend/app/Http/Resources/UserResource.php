<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\ApiDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Object User, xem docs/api-contract.md mục 2.1.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    private ?User $impersonatorOverride = null;

    private bool $hasOverride = false;

    /** Dùng khi trả User cho một token khác token của request hiện tại (vừa tạo token impersonate). */
    public function impersonatedBy(?User $impersonator): static
    {
        $this->impersonatorOverride = $impersonator;
        $this->hasOverride = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $impersonator = $this->hasOverride ? $this->impersonatorOverride : $this->resource->impersonator();

        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'role' => $this->role,
            'has_password' => $this->password !== null,
            'email_verified' => $this->email_verified_at !== null,
            'impersonator' => $impersonator ? ['id' => $impersonator->id, 'email' => $impersonator->email] : null,
            'timezone' => $this->timezone,
            'onboarding_completed' => $this->onboarding_completed_at !== null,
            'created_at' => ApiDate::format($this->created_at),
        ];
    }
}
