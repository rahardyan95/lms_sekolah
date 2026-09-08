<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;

class StudentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'bendahara', 'operator']);
    }

    public function view(User $user, Student $student): bool
    {
        if ($user->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'bendahara', 'operator'])) {
            return true;
        }

        if ($user->hasRole('siswa')) {
            return $user->student?->id === $student->id;
        }

        return false;
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function update(User $user, Student $student): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function delete(User $user, Student $student): bool
    {
        return $user->hasRole('super_admin');
    }
}
