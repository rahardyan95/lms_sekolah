<?php

namespace App\Services;

use App\Models\OtpCode;
use Illuminate\Support\Facades\Hash;

/**
 * OTP parent-login: issue (hash + expiry 5 mnt, single-use)
 * dan verify (cek expiry + hash, consume atomik).
 * Controller tetap tipis — semua aturan domain di sini (OOP).
 */
class OtpService
{
    public function issue(string $identifier, string $purpose = 'parent_login'): array
    {
        OtpCode::where('identifier', $identifier)
            ->whereNull('consumed_at')
            ->delete();

        $code = (string) random_int(100000, 999999);

        OtpCode::create([
            'identifier' => $identifier,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(5),
        ]);

        return ['code' => $code, 'expires_in' => 300];
    }

    public function verify(string $identifier, string $code): bool
    {
        $otp = OtpCode::where('identifier', $identifier)
            ->whereNull('consumed_at')
            ->latest()
            ->first();

        if (! $otp) {
            return false;
        }

        // Lockout brute-force: 5x salah → kode dihapus.
        if ($otp->attempts >= 5) {
            $otp->delete();

            return false;
        }

        if ($otp->expires_at->isPast() || ! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');

            return false;
        }

        // Konsumsi adalah gate-nya: hanya permintaan yang benar-benar mengubah
        // consumed_at dari NULL yang boleh menukar token (anti replay paralel).
        $consumed = OtpCode::whereKey($otp->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        return $consumed === 1;
    }
}
