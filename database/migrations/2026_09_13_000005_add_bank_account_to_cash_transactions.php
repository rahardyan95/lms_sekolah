<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kanal dana transaksi kas: NULL = kas tunai, terisi = rekening bank.
     * Dipakai laporan arus kas terpisah kas vs bank (FRD §12).
     */
    public function up(): void
    {
        Schema::table('cash_transactions', function (Blueprint $table) {
            // bank_accounts.id adalah ULID (domain entity) — bukan bigint.
            $table->foreignUlid('bank_account_id')->nullable()->after('type')
                ->constrained('bank_accounts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cash_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bank_account_id');
        });
    }
};
