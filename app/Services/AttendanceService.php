<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Events\AttendanceRecorded;
use App\Models\Attendance;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

class AttendanceService
{
    public function recordScan(Student $student, string $date, ?string $device, ?string $operatorId, ?string $idempotencyKey): Attendance
    {
        return DB::transaction(function () use ($student, $date, $device, $operatorId, $idempotencyKey) {
            if ($idempotencyKey) {
                $existing = Attendance::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing;
                }
            }

            $duplicate = Attendance::where('student_id', $student->id)->where('date', $date)->first();
            if ($duplicate) {
                abort(response()->json([
                    'data' => null, 'meta' => null,
                    'errors' => ['code' => 'CONFLICT', 'message' => 'Presensi hari ini sudah tercatat.'],
                    'request_id' => request()->header('X-Request-ID', str()->ulid()),
                ], 409));
            }

            $lateAt = config('school.late_after', '07:00');
            $now = now(config('school.timezone', 'Asia/Jakarta'))->format('H:i');
            $status = $now > $lateAt ? AttendanceStatus::Terlambat : AttendanceStatus::Hadir;

            $attendance = Attendance::create([
                'student_id' => $student->id,
                'date' => $date,
                'time_in' => now()->format('H:i:s'),
                'status' => $status,
                'source' => 'qr',
                'operator_id' => $operatorId,
                'device' => $device,
                'idempotency_key' => $idempotencyKey,
            ]);

            event(new AttendanceRecorded($attendance));

            return $attendance;
        });
    }
}
