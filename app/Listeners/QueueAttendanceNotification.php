<?php

namespace App\Listeners;

use App\Events\AttendanceRecorded;
use App\Jobs\SendAttendanceNotification;

/**
 * Listener tipis: event domain -> dispatch job queue.
 * Logika pengiriman ada di Job (retryable), bukan di listener.
 */
class QueueAttendanceNotification
{
    public function handle(AttendanceRecorded $event): void
    {
        SendAttendanceNotification::dispatch($event->attendance->id);
    }
}
