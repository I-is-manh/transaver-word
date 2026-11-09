<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tab ngôn ngữ và lọc ?lang= ở "Từ của tôi" (contract mục 3.11). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_words', function (Blueprint $table) {
            $table->index(['user_id', 'source_lang'], 'user_words_user_id_source_lang_index');
        });
    }

    public function down(): void
    {
        Schema::table('user_words', function (Blueprint $table) {
            $table->dropIndex('user_words_user_id_source_lang_index');
        });
    }
};
