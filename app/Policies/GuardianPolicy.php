<?php

namespace App\Policies;

use App\Enums\RoleEnum;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Portal orang tua: guardian hanya boleh melihat data anak yang terhubung
 * lewat pivot guardian_student (pencegahan IDOR horizontal).
 */
class GuardianPolicy
{
    use HandlesAuthorization;

    public function viewChildren(User $user, Guardian $guardian): bool
    {
        return $guardian->user_id === $user->id
            && $user->status === 'active'
            && $user->hasRole(RoleEnum::OrangTua->value);
    }

    public function viewStudentAttendance(User $user, Guardian $guardian, Student $student): bool
    {
        return $this->viewChildren($user, $guardian)
            && $guardian->students()->whereKey($student->id)->exists();
    }

    /** Helper OOP lintas-policy: apakah user adalah wali dari student_id tsb. */
    public static function isGuardianOf(User $user, string $studentId): bool
    {
        if (! $user->hasRole(RoleEnum::OrangTua->value) || $user->status !== 'active') {
            return false;
        }

        return Guardian::query()->where('user_id', $user->id)
            ->whereHas('students', fn ($q) => $q->whereKey($studentId))
            ->exists();
    }
}
