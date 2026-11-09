<?php

namespace App\Fsrs;

/** Mức đánh giá: 1 Quên (Again), 2 Khó (Hard), 3 Được (Good), 4 Dễ (Easy). */
final class Rating
{
    public const AGAIN = 1;

    public const HARD = 2;

    public const GOOD = 3;

    public const EASY = 4;

    public const ALL = [self::AGAIN, self::HARD, self::GOOD, self::EASY];
}
