<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nomor WA staf (guru/operator dll) untuk notifikasi & broadcast.
     * Tanpa kolom ini, broadcast ke audiens 'guru' tidak punya tujuan sama sekali.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('phone')->nullable()->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('phone');
        });
    }
};
