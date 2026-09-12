<?php

namespace App\Jobs;

use App\Contracts\WhatsappGatewayInterface;
use App\Models\Attendance;
use App\Models\NotificationLog;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Notifikasi presensi ke WA orang tua — idempotent per attendance.
 * Retry 3x dengan backoff agar provider timeout/rate-limit bisa pulih.
 * Setiap percobaan tercatat di notification_logs (attempts menumpuk).
 */
class SendAttendanceNotification implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public const TEMPLATE = 'attendance';

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function __construct(public string $attendanceId) {}

    public function uniqueId(): string
    {
        return 'attendance-notif:'.$this->attendanceId;
    }

    public function handle(WhatsappGatewayInterface $gateway): void
    {
        $attendance = Attendance::with('student.guardians')->find($this->attendanceId);

        if (! $attendance || ! $attendance->student) {
            return;
        }

        $guardian = $attendance->student->guardians->first();

        if (! $guardian || empty($guardian->phone)) {
            Log::info('attendance.notif.skipped', ['attendance_id' => $this->attendanceId]);

            return;
        }

        $log = $this->log((string) $guardian->phone);

        $status = $attendance->status instanceof \BackedEnum
            ? $attendance->status->value
            : (string) $attendance->status;

        $message = sprintf(
            '%s — %s tercatat %s pada %s pukul %s.',
            config('school.name', 'Sekolah'),
            $attendance->student->name,
            $status,
            $attendance->date,
            $attendance->time_in ?? '-'
        );

        $result = $gateway->sendMessage((string) $guardian->phone, $message);

        Log::info('attendance.notif.dispatched', [
            'attendance_id' => $this->attendanceId,
            'status' => $result['status'] ?? 'unknown',
        ]);

        if (($result['status'] ?? null) === 'failed' && isset($result['error'])) {
            $log->update(['status' => NotificationLog::STATUS_FAILED, 'last_error' => (string) $result['error']]);

            throw new \RuntimeException('WA gateway failed: '.$result['error']);
        }

        $log->update([
            'status' => NotificationLog::STATUS_SENT,
            'provider_ref' => (string) ($result['provider'] ?? 'unknown'),
            'last_error' => null,
        ]);
    }

    /** Job menyerah setelah semua percobaan — tandai baris log gagal permanen. */
    public function failed(\Throwable $e): void
    {
        $attendance = Attendance::with('student.guardians')->find($this->attendanceId);
        $guardian = $attendance?->student?->guardians->first();

        if (! $guardian || empty($guardian->phone)) {
            return;
        }

        $this->log((string) $guardian->phone)->update([
            'status' => NotificationLog::STATUS_FAILED,
            'last_error' => $e->getMessage(),
        ]);
    }

    private function log(string $recipient): NotificationLog
    {
        $log = NotificationLog::firstOrCreate(
            [
                'channel' => 'whatsapp',
                'recipient' => $recipient,
                'template' => self::TEMPLATE.':'.$this->attendanceId,
            ],
            ['status' => NotificationLog::STATUS_PROCESSING, 'attempts' => 0],
        );

        $log->increment('attempts');
        $log->update(['status' => NotificationLog::STATUS_PROCESSING, 'last_error' => null]);

        return $log->refresh();
    }
}
