<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Events\AttendanceRecorded;
use App\Models\Attendance;
use App\Models\AuditLog;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AttendanceService
{
    public function __construct(protected ?SettingsService $settings = null) {}

    /** Kebijakan dari panel Pengaturan lebih dulu; env/config hanya fallback. */
    private function setting(string $key, mixed $fallback): mixed
    {
        $value = $this->settings?->value($key);

        return ($value === null || $value === '') ? $fallback : $value;
    }

    public function recordScan(Student $student, string $date, ?string $device, ?string $operatorId, ?string $idempotencyKey, string $source = 'qr'): Attendance
    {
        return DB::transaction(function () use ($student, $date, $device, $operatorId, $idempotencyKey, $source) {
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

            $lateAt = (string) $this->setting('late_after', config('school.late_after', '07:00'));
            $tz = (string) $this->setting('timezone', config('school.timezone', 'Asia/Jakarta'));
            $now = now($tz);
            // Format env bisa '7:00' tanpa padding; bandingkan via Carbon, bukan
            // perbandingan leksikografis string ('07:10' > '7:00' selalu false).
            $lateTime = rescue(fn () => Carbon::parse((string) $lateAt)->format('H:i'), '07:00', report: false);
            $status = $now->format('H:i') > $lateTime ? AttendanceStatus::Terlambat : AttendanceStatus::Hadir;

            $attendance = $this->createOrConflict($student, $date, [
                'student_id' => $student->id,
                'date' => $date,
                'time_in' => $now->format('H:i:s'),
                'status' => $status,
                'source' => $source,
                'operator_id' => $operatorId,
                'device' => $device,
                'idempotency_key' => $idempotencyKey,
            ]);

            event(new AttendanceRecorded($attendance));

            return $attendance;
        });
    }

    /**
     * Fallback manual (FRD §7.2): hanya role berpermission, wajib reason,
     * status, operator, dan audit. Duplikat tanggal tetap ditolak 409 —
     * entri manual tidak boleh menimpa presensi yang sudah tercatat.
     */
    public function recordManual(Student $student, string $date, AttendanceStatus $status, string $reason, User $operator): Attendance
    {
        return DB::transaction(function () use ($student, $date, $status, $reason, $operator) {
            $duplicate = Attendance::where('student_id', $student->id)->where('date', $date)->first();

            if ($duplicate) {
                abort(response()->json([
                    'data' => null, 'meta' => null,
                    'errors' => ['code' => 'CONFLICT', 'message' => 'Presensi hari ini sudah tercatat.'],
                    'request_id' => request()->header('X-Request-ID', str()->ulid()),
                ], 409));
            }

            $attendance = $this->createOrConflict($student, $date, [
                'student_id' => $student->id,
                'date' => $date,
                'time_in' => null,
                'status' => $status,
                'source' => 'manual',
                'operator_id' => $operator->id,
            ]);

            AuditLog::create([
                'actor_id' => $operator->id,
                'actor_role' => $operator->getRoleNames()->first(),
                'action' => 'ATTENDANCE_MANUAL',
                'entity' => 'attendances',
                'entity_id' => $attendance->id,
                'after' => [
                    'student_id' => $student->id,
                    'status' => $status->value,
                    'reason' => $reason,
                ],
                'ip_address' => request()->ip(),
                'request_id' => request()->header('X-Request-ID'),
            ]);

            return $attendance;
        });
    }

    /**
     * Insert presensi dengan penanganan balapan: dua scan bersamaan sama-sama
     * lolos probe duplikat, lalu unique(student_id,date) menolak yang kalah di
     * Postgres. Kontrak anti-duplikat tetap 409 CONFLICT — bukan 500 tanpa
     * envelope. (idempotency_key yang sama juga jatuh ke sini.)
     */
    private function createOrConflict(Student $student, string $date, array $attributes): Attendance
    {
        try {
            return Attendance::create($attributes);
        } catch (UniqueConstraintViolationException) {
            $this->abortDuplicate();
        }
    }

    private function abortDuplicate(): never
    {
        abort(response()->json([
            'data' => null, 'meta' => null,
            'errors' => ['code' => 'CONFLICT', 'message' => 'Presensi hari ini sudah tercatat.'],
            'request_id' => request()->header('X-Request-ID', str()->ulid()),
        ], 409));
    }
}
