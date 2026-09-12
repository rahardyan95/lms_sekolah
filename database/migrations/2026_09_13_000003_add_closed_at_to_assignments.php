<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            // Tenggat lewat ≠ tugas ditutup: guru bisa menutup tugas lebih awal
            // atau membiarkan pengumpulan terlambat sampai ditutup manual.
            $table->timestamp('closed_at')->nullable()->after('deadline');
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropColumn('closed_at');
        });
    }
};
