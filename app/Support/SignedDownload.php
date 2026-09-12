<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

/**
 * Signed download link untuk berkas privat (materi LMS, e-book, berkas SPMB).
 * Link berumur pendek sehingga tidak bisa dibagikan/di-bookmark selamanya;
 * otorisasi peran tetap ditegakkan middleware auth + policy di route-nya.
 */
final class SignedDownload
{
    public const TTL_MINUTES = 15;

    /** @param array<string, mixed> $parameters */
    public static function url(string $routeName, array $parameters): string
    {
        return URL::temporarySignedRoute(
            $routeName,
            now()->addMinutes(self::TTL_MINUTES),
            $parameters
        );
    }
}
