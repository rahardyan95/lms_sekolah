<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ScanAttendanceRequest;
use App\Models\Attendance;
use App\Models\Student;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(protected AttendanceService $service) {}

    public function scan(ScanAttendanceRequest $request): JsonResponse
    {
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

    public function reports(Request $request): JsonResponse
    {
        $this->authorize('viewReports', Attendance::class);

        $data = $request->validate([
            'class_room_id' => ['nullable', 'string'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'status' => ['nullable', 'string'],
        ]);

        $query = Attendance::with('student')
            ->whereBetween('date', [$data['from'], $data['to']])
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($data['class_room_id'] ?? null, fn ($q, $c) => $q->whereHas('student', fn ($s) => $s->where('class_room_id', $c)));

        return response()->json([
            'data' => $query->paginate(25),
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }
}
