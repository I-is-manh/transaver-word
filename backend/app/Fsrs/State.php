<?php

namespace App\Fsrs;

/** Trạng thái thẻ trong FSRS (khớp cột user_words.fsrs_state). */
final class State
{
    public const NEW = 0;

    public const LEARNING = 1;

    public const REVIEW = 2;

    public const RELEARNING = 3;
}
