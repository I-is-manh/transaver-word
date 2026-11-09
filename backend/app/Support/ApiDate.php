<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Support\Carbon;

/** Định dạng thời điểm trong API: ISO 8601, UTC, có "Z" (docs/api-contract.md mục 1.3). */
final class ApiDate
{
    public static function format(?DateTimeInterface $value): ?string
    {
        return $value === null ? null : Carbon::instance($value)->utc()->format('Y-m-d\TH:i:s\Z');
    }
}
