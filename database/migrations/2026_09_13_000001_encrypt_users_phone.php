<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Nomor WA staf kini PII terenkripsi (setara Guardian.phone): nilai lama
     * yang masih plaintext dienkripsi di tempat. Idempoten — nilai yang sudah
     * terenkripsi dilewati.
     */
    public function up(): void
    {
        DB::table('users')->whereNotNull('phone')->where('phone', '!=', '')->orderBy('id')
            ->each(function (object $row): void {
                try {
                    Crypt::decryptString((string) $row->phone);

                    return;
                } catch (Throwable) {
                    // Masih plaintext → enkripsi.
                }

                DB::table('users')->where('id', $row->id)
                    ->update(['phone' => Crypt::encryptString((string) $row->phone)]);
            });
    }

    public function down(): void
    {
        DB::table('users')->whereNotNull('phone')->where('phone', '!=', '')->orderBy('id')
            ->each(function (object $row): void {
                try {
                    $plain = Crypt::decryptString((string) $row->phone);
                } catch (Throwable) {
                    return;
                }

                DB::table('users')->where('id', $row->id)->update(['phone' => $plain]);
            });
    }
};
