<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\KtsToken;
use App\Models\Student;
use App\Services\KtsService;
use App\Services\PdfService;
use App\Services\QrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class KtsController extends Controller
{
    public function __construct(
        protected KtsService $service,
        protected PdfService $pdf,
        protected QrService $qr,
    ) {}

    public function issue(Request $request, Student $student): JsonResponse
    {
        $this->authorize('issueKts', KtsToken::class);

        return $this->envelope($request, $this->service->issue($student), 201);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'payload' => ['required', 'string', 'max:512'],
            'signature' => ['required', 'string', 'size:64'],
        ]);

        $result = $this->service->verify($data['payload'], $data['signature']);

        return $this->envelope($request, $result, $result['valid'] ? 200 : 422);
    }

    public function revoke(Request $request, KtsToken $token): JsonResponse
    {
        $this->authorize('issueKts', KtsToken::class);
        $this->service->revoke($token);

        return $this->envelope($request, ['message' => 'Token QR dicabut.']);
    }

    public function template(Request $request): JsonResponse
    {
        // Template kartu adalah konfigurasi operasional sekolah (bukan data publik):
        // peran portal seperti calon_siswa tidak boleh membacanya.
        $this->authorize('issueKts', KtsToken::class);

        return $this->envelope($request, $this->service->activeTemplate());
    }

    /** Unggah/ganti foto siswa untuk kartu (jpg/png, maks 2 MB). */
    public function uploadPhoto(Request $request, Student $student): JsonResponse
    {
        $this->authorize('issueKts', KtsToken::class);

        $data = $request->validate([
            'photo' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png'],
        ]);

        $path = $this->service->storePhoto($student, $data['photo']);

        return $this->envelope($request, [
            'photo_path' => $path,
            'photo_url' => $student->refresh()->photo_url,
        ]);
    }

    /** Sajikan foto kartu; hanya lewat URL bertanda tangan (route memakai `signed`). */
    public function photo(Request $request, Student $student): Response
    {
        $path = $student->photo_path;

        abort_unless($path && Storage::disk('local')->exists($path), 404, 'Foto tidak ditemukan.');

        return Storage::disk('local')->response($path);
    }

    /** Token QR milik satu siswa (audit + pencabutan). */
    public function tokens(Request $request, Student $student): JsonResponse
    {
        $this->authorize('issueKts', KtsToken::class);

        return $this->envelope($request, $this->service->tokens($student));
    }

    public function saveTemplate(Request $request): JsonResponse
    {
        $this->authorize('manageKts', KtsToken::class);

        $data = $request->validate([
            'colors' => ['nullable', 'array'],
            'colors.*' => ['nullable', 'string', 'max:32'],
            'visibility' => ['nullable', 'array'],
            'visibility.*' => ['boolean'],
            'watermark' => ['nullable', 'string', 'max:64'],
        ]);

        return $this->envelope($request, $this->service->saveTemplate($data, $request->user()));
    }

    /** KTS sebagai PDF aktual (bukan snapshot klien). */
    public function card(Request $request, Student $student): Response
    {
        $this->authorize('viewKtsCard', $student);

        $data = $this->service->cardData($student);

        return $this->pdf->pdf('pdf.kts-card', [
            'student' => $data['student'],
            'template' => $data['template'],
            'qrSvg' => $this->qr->svg($data['qr']),
            'maskedNik' => $data['masked_nik'],
            'schoolName' => (string) config('school.name'),
        ])->download("kts-{$student->nisn}.pdf");
    }

    /** QR vektor SVG untuk modal presensi/preview. */
    public function qr(Request $request, Student $student): Response
    {
        $this->authorize('viewKtsCard', $student);

        return response($this->qr->svg($this->service->qrString($student), 260), 200, [
            'Content-Type' => 'image/svg+xml',
        ]);
    }

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }
}
