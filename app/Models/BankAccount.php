<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Rekening bank sekolah. Nomor lengkap disimpan terenkripsi dan disembunyikan
 * dari serialisasi; yang tampil hanya versi ter-mask (4 digit terakhir).
 */
class BankAccount extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['bank', 'account_number', 'account_masked', 'holder', 'active'];

    protected $hidden = ['account_number'];

    protected $casts = ['account_number' => 'encrypted', 'active' => 'boolean'];

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public static function mask(string $accountNumber): string
    {
        $digits = preg_replace('/\D/', '', $accountNumber) ?? '';

        return $digits === '' ? '****' : '****'.substr($digits, -4);
    }
}
