<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fail-closed: jangan hapus attempt siswa diam-diam untuk memaksa index.
        // Postgres menolak alias SELECT di HAVING: gunakan ekspresi COUNT(*) langsung.
        $duplicates = DB::table('cbt_attempts')
            ->select('exam_id', 'user_id', DB::raw('COUNT(*) as aggregate'))
            ->groupBy('exam_id', 'user_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException(
                'Duplicate cbt_attempts rows exist; resolve manually before applying the unique index: '
                .$duplicates->toJson()
            );
        }

        Schema::table('cbt_attempts', function (Blueprint $table) {
            $table->unique(['exam_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('cbt_attempts', function (Blueprint $table) {
            $table->dropUnique(['exam_id', 'user_id']);
        });
    }
};
