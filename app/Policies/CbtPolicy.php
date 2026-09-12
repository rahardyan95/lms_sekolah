<?php

namespace App\Policies;

use App\Models\CbtAttempt;
use App\Models\CbtExam;
use App\Models\User;

class CbtPolicy
{
    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);
    }

    /** Publikasi hanya boleh bila ujian sudah punya minimal satu soal (FRD §10). */
    public function publish(User $user, CbtExam $exam): bool
    {
        return $this->manage($user)
            && $exam->questions()->exists();
    }

    public function attempt(User $user): bool
    {
        return $user->hasAnyRole(['siswa', 'super_admin']);
    }

    public function viewAttempt(User $user, CbtAttempt $attempt): bool
    {
        if ($user->id === $attempt->user_id) {
            return true;
        }

        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);
    }

    public function viewExam(User $user, CbtExam $exam): bool
    {
        if ($exam->status !== CbtExam::STATUS_PUBLISHED) {
            return $this->manage($user);
        }

        if ($this->manage($user)) {
            return true;
        }

        $kelas = $user->student?->classRoom?->name;

        return $kelas !== null && $kelas === $exam->kelas;
    }
}
