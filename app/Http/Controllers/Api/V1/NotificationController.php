<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\SendAttendanceNotification;
use App\Jobs\SendBroadcastBatch;
use App\Models\NotificationLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('manageNotifications', NotificationLog::class);

        $data = $request->validate([
            'status' => ['nullable', 'in:'.implode(',', [
                NotificationLog::STATUS_PENDING, NotificationLog::STATUS_PROCESSING,
                NotificationLog::STATUS_SENT, NotificationLog::STATUS_FAILED,
            ])],
        ]);

        $logs = NotificationLog::query()
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(25);

        return $this->envelope($request, $logs);
    }

    /** Kirim ulang satu baris log dengan mengulang job yang sesuai. */
    public function retry(Request $request, NotificationLog $log): JsonResponse
    {
        $this->authorize('manageNotifications', NotificationLog::class);

        [$template, $subjectId] = array_pad(explode(':', $log->template, 2), 2, null);

        if (! $subjectId) {
            abort(422, 'Log ini tidak dapat dikirim ulang.');
        }

        match ($template) {
            SendAttendanceNotification::TEMPLATE => SendAttendanceNotification::dispatch($subjectId),
            SendBroadcastBatch::TEMPLATE => SendBroadcastBatch::dispatch($subjectId, [[
                'name' => $log->recipient,
                'phone' => $log->recipient,
            ]], false),
            default => abort(422, 'Jenis notifikasi tidak dikenali.'),
        };

        $log->update(['status' => NotificationLog::STATUS_PROCESSING, 'last_error' => null]);

        return $this->envelope($request, $log->refresh());
    }
}
