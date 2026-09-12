<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Satu titik render PDF (DomPDF). View selalu di `resources/views/pdf/`
 * dan wajib memakai CSS inline — DomPDF tidak mengambil aset remote.
 */
class PdfService
{
    public function pdf(string $view, array $data = []): \Barryvdh\DomPDF\PDF
    {
        return Pdf::loadView($view, $data)->setPaper('a4');
    }
}
