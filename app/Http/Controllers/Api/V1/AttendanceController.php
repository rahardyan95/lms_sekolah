<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AttendanceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ManualAttendanceRequest;
use App\Http\Requests\ScanAttendanceRequest;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Services\AttendanceReportService;
use App\Services\AttendanceService;
use App\Services\PdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    public function __construct(
        protected AttendanceService $service,
        protected AttendanceReportService $reportService,
        protected PdfService $pdf,
    ) {}

    public function scan(ScanAttendanceRequest $request): JsonResponse
    {
        $this->authorize('scan', Attendance::class);

        $student = Student::where('nisn', $request->string('nisn'))->firstOrFail();

        $attendance = $this->service->recordScan(
            $student,
            $request->date('date')->format('Y-m-d'),
            $request->string('device')->toString() ?: null,
            $request->user()->id,
            $request->string('idempotency_key')->toString() ?: null,
        );

        return response()->json([
            'data' => $attendance,
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], 201);
    }

    public function manual(ManualAttendanceRequest $request): JsonResponse
    {
        $student = Student::where('nisn', $request->string('nisn'))->firstOrFail();

        $attendance = $this->service->recordManual(
            $student,
            $request->date('date')->format('Y-m-d'),
            AttendanceStatus::from($request->string('status')->toString()),
            $request->string('reason')->toString(),
            $request->user(),
        );

        return response()->json([
            'data' => $attendance,
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], 201);
    }

    public function reports(Request $request): JsonResponse
    {
        $this->authorize('viewReports', Attendance::class);

        $data = $this->validateFilters($request);

        return response()->json([
            'data' => $this->reportService->query($data)->paginate(25),
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    /**
     * Ekspor laporan presensi sebagai PDF (rekap per siswa) — pelengkap CSV.
     * Authorization & batas rentang identik dengan ekspor CSV.
     */
    public function exportPdf(Request $request): Response
    {
        $this->authorize('viewReports', Attendance::class);

        $data = $this->validateFilters($request);

        $classRoom = empty($data['class_room_id'])
            ? null
            : ClassRoom::whereKey($data['class_room_id'])->value('name');

        return $this->pdf->pdf('pdf.attendance-report', [
            'from' => $data['from'],
            'to' => $data['to'],
            'classRoom' => $classRoom,
            'rows' => $this->reportService->reportRows($data),
        ])->download("presensi-{$data['from']}_{$data['to']}.pdf");
    }

    /** Ekspor CSV streaming (FRD: export CSV/PDF) — aman dari formula injection. */
    public function export(Request $request): StreamedResponse
    {
        $this->authorize('viewReports', Attendance::class);

        $data = $this->validateFilters($request);
        $service = $this->reportService;
        $filename = 'presensi-'.$data['from'].'_'.$data['to'].'.csv';

        return response()->streamDownload(function () use ($service, $data): void {
            $out = fopen('php://output', 'w');
            foreach ($service->csvRows($data) as $row) {
                fputcsv($out, array_map([$service, 'sanitizeCell'], $row));
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /** @return array{class_room_id?: string|null, from: string, to: string, status?: string|null} */
    private function validateFilters(Request $request): array
    {
        $data = $request->validate([
            'class_room_id' => ['nullable', 'string'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'status' => ['nullable', 'string'],
        ]);

        // Rentang dibatasi agar ekspor tidak menarik data tak terbatas.
        $from = Carbon::parse($data['from']);
        $to = Carbon::parse($data['to']);
        if ($from->diffInDays($to) > AttendanceReportService::MAX_EXPORT_DAYS) {
            abort(response()->json([
                'data' => null, 'meta' => null,
                'errors' => [
                    'code' => 'RANGE_TOO_WIDE',
                    'message' => 'Rentang laporan maksimal '.AttendanceReportService::MAX_EXPORT_DAYS.' hari.',
                ],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 422));
        }

        return $data;
    }
}
