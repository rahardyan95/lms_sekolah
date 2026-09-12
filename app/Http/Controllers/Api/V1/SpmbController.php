<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SpmbApplication;
use App\Models\SpmbFile;
use App\Models\SpmbWave;
use App\Services\PdfService;
use App\Services\SpmbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SpmbController extends Controller
{
    public function __construct(protected SpmbService $service) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function waves(): JsonResponse
    {
        $waves = SpmbWave::withCount(['applications as filled' => fn ($q) => $q->whereIn('status', ['verified', 'accepted'])])
            ->where('active', true)
            ->orderBy('start_date')
            ->get()
            ->map(fn (SpmbWave $w) => [
                'id' => $w->id, 'name' => $w->name,
                'start_date' => $w->start_date->format('Y-m-d'),
                'end_date' => $w->end_date->format('Y-m-d'),
                'quota' => $w->quota, 'filled' => $w->filled,
                'fee' => $w->fee, 'is_open' => $w->isOpen(),
            ]);

        return response()->json([
            'data' => $waves, 'meta' => null, 'errors' => null,
            'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function submit(Request $request, SpmbWave $wave): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'nisn' => ['required', 'string', 'max:20', 'unique:spmb_applications,nisn'],
            'nik' => ['nullable', 'string', 'max:64'],
            'gender' => ['required', 'in:L,P'],
            'birth_place' => ['nullable', 'string', 'max:128'],
            'birth_date' => ['nullable', 'date'],
            'parent_name' => ['required', 'string', 'max:255'],
            'parent_phone' => ['nullable', 'string', 'max:32'],
            'previous_school' => ['nullable', 'string', 'max:255'],
            'average_score' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'chosen_major' => ['nullable', 'string', 'max:128'],
        ]);

        return $this->envelope($request, $this->service->submit($wave, $data, $request->user()), 201);
    }

    public function status(Request $request): JsonResponse
    {
        $data = $request->validate([
            'registration_number' => ['required', 'string', 'max:32'],
            'birth_date' => ['required', 'date'],
        ]);

        $application = SpmbApplication::where('registration_number', $data['registration_number'])
            ->whereDate('birth_date', $data['birth_date'])
            ->first();

        if (! $application) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'NOT_FOUND', 'message' => 'Data pendaftaran tidak ditemukan.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 404);
        }

        return $this->envelope($request, $application->only([
            'registration_number', 'name', 'status', 'notes', 'verified_at',
        ]));
    }

    public function upload(Request $request, SpmbApplication $application): JsonResponse
    {
        $data = $request->validate([
            'registration_number' => ['required', 'string', 'max:32'],
            'birth_date' => ['required', 'date'],
            'kind' => ['required', 'in:'.implode(',', SpmbFile::KINDS)],
            'file' => ['required', 'file', 'max:2048', 'mimes:pdf,jpg,jpeg,png'],
        ]);

        // Pendaftar tidak punya sesi: kredensial yang sama dengan endpoint status.
        $matches = $application->registration_number === $data['registration_number']
            && $application->birth_date?->format('Y-m-d') === Carbon::parse($data['birth_date'])->format('Y-m-d');

        if (! $matches) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'FORBIDDEN', 'message' => 'Kredensial pendaftaran tidak cocok.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 403);
        }

        if ($application->status !== SpmbApplication::STATUS_DRAFT) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'UPLOAD_CLOSED', 'message' => 'Berkas hanya dapat diunggah selama status draft.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 422);
        }

        /** @var UploadedFile $file */
        $file = $data['file'];
        $path = $file->store('spmb/'.$application->id, 'local');

        $record = $application->files()->create([
            'kind' => $data['kind'],
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType() ?? 'application/octet-stream',
            'size' => $file->getSize() ?? 0,
        ]);

        return $this->envelope($request, $record, 201);
    }

    /** Bukti pendaftaran resmi (PDF). Kredensial sama dengan cek status. */
    public function proof(Request $request, SpmbApplication $application, PdfService $pdf): Response
    {
        $data = $request->validate([
            'registration_number' => ['required', 'string', 'max:32'],
            'birth_date' => ['required', 'date'],
        ]);

        $matches = $application->registration_number === $data['registration_number']
            && $application->birth_date?->format('Y-m-d') === Carbon::parse($data['birth_date'])->format('Y-m-d');

        if (! $matches) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'FORBIDDEN', 'message' => 'Kredensial pendaftaran tidak cocok.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 403);
        }

        $application->loadMissing('wave');

        return $pdf->pdf('pdf.spmb-proof', ['application' => $application])
            ->download("bukti-spmb-{$application->registration_number}.pdf");
    }

    public function review(Request $request): JsonResponse
    {
        $this->authorize('review', SpmbApplication::class);

        $data = $request->validate([
            'wave_id' => ['nullable', 'string', 'exists:spmb_waves,id'],
            'status' => ['nullable', 'in:draft,verified,accepted,rejected'],
        ]);

        $apps = SpmbApplication::with('wave:id,name')
            ->when($data['wave_id'] ?? null, fn ($q, $w) => $q->where('wave_id', $w))
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(25);

        return $this->envelope($request, $apps);
    }

    public function verify(Request $request, SpmbApplication $application): JsonResponse
    {
        $this->authorize('review', SpmbApplication::class);

        return $this->envelope($request, $this->service->verify($application, $request->user()));
    }

    public function decide(Request $request, SpmbApplication $application): JsonResponse
    {
        $this->authorize('decide', SpmbApplication::class);

        $data = $request->validate([
            'status' => ['required', 'in:accepted,rejected'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->envelope($request, $this->service->decide($application, $request->user(), $data['status'], $data['notes'] ?? null));
    }

    public function convert(Request $request, SpmbApplication $application): JsonResponse
    {
        $this->authorize('decide', SpmbApplication::class);

        return $this->envelope($request, $this->service->convert($application), 201);
    }

    public function download(Request $request, SpmbFile $file): StreamedResponse
    {
        $this->authorize('viewApplication', $file->application);

        return Storage::disk('local')->download($file->path, $file->original_name);
    }
}
