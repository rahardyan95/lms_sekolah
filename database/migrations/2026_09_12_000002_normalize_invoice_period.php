<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Periode kosong dinormalkan ke sentinel agar unique(student_id,item_id,period)
    // benar-benar menahan duplikat (NULL tidak pernah sama dengan NULL di SQL).
    public function up(): void
    {
        DB::table('invoices')->whereNull('period')->update(['period' => '-']);
    }

    public function down(): void
    {
        DB::table('invoices')->where('period', '-')->update(['period' => null]);
    }
};
