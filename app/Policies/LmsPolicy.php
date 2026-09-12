<?php

namespace App\Policies;

use App\Models\Assignment;
use App\Models\Grade;
use App\Models\Material;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;

class LmsPolicy
{
    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);
    }

    public function study(User $user): bool
    {
        return $user->hasAnyRole(['siswa', 'super_admin']);
    }

    private function classOf(User $user): ?string
    {
        return $user->student?->classRoom?->name;
    }

    public function viewMaterial(User $user, Material $material): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        return $this->study($user)
            && ($material->kelas === null || $material->kelas === $this->classOf($user));
    }

    public function viewAssignment(User $user, Assignment $assignment): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        return $this->study($user)
            && ($assignment->kelas === null || $assignment->kelas === $this->classOf($user));
    }

    public function submitAssignment(User $user, Assignment $assignment): bool
    {
        return $this->viewAssignment($user, $assignment) && $user->student !== null;
    }

    public function viewSubmission(User $user, Submission $submission): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        return $user->student?->id === $submission->student_id;
    }

    public function viewGrade(User $user, Grade $grade): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        return $user->student?->id === $grade->student_id && $grade->published;
    }

    public function viewSubject(User $user, Subject $subject): bool
    {
        return $this->manage($user) || $this->study($user);
    }

    public function viewAnyMaterial(User $user): bool
    {
        return $this->manage($user) || $this->study($user);
    }

    public function viewAnyAssignment(User $user): bool
    {
        return $this->manage($user) || $this->study($user);
    }
}
