<?php

namespace App\Policies;

use App\Models\Attendance;
use App\Models\User;

class AttendancePolicy
{
    public function scan(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }

    public function viewReports(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }

    public function viewOwn(User $user, Attendance $attendance): bool
    {
        return $user->student?->id === $attendance->student_id
            || $user->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }
}
