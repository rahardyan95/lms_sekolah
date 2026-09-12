<?php

namespace App\Services;

use SimpleSoftwareIO\QrCode\Facades\QrCode;

/**
 * QR vektor SVG (presisi tinggi, diskalakan tanpa pecah).
 * Payload KTS adalah token bertanda tangan dari KtsService, bukan NISN mentah.
 */
class QrService
{
    public function svg(string $payload, int $size = 320): string
    {
        return (string) QrCode::format('svg')->size($size)->margin(1)->generate($payload);
    }
}
