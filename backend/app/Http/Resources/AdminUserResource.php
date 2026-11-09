<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\ApiDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Object AdminUser (contract mục 9). Cần select sẵn words_count và last_active_date.
 *
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->status,
            'created_at' => ApiDate::format($this->created_at),
            'words_count' => (int) $this->words_count,
            'last_active_date' => $this->last_active_date ? substr((string) $this->last_active_date, 0, 10) : null,
        ];
    }
}
