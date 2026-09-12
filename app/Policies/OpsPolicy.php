<?php

namespace App\Policies;

use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;

class OpsPolicy
{
    public function manageLibrary(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function borrowBook(User $user): bool
    {
        return $user->hasAnyRole(['siswa', 'guru', 'super_admin']);
    }

    /**
     * Baca e-book perpustakaan: komunitas sekolah yang aktif.
     * Calon siswa (belum diterima) & peran non-sekolah tidak termasuk.
     */
    public function viewEbook(User $user): bool
    {
        return $user->hasAnyRole(['siswa', 'guru', 'super_admin', 'admin_tu', 'operator']);
    }

    public function manageAcademic(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);
    }

    public function manageCms(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function issueKts(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'operator']);
    }

    /**
     * Ubah template KTS: fungsi operasional sekolah (bukan pengajaran),
     * jadi sengaja LEBIH KETAT daripada manageAcademic yang menyertakan guru.
     */
    public function manageKts(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    /**
     * Lihat/cetak KTS: staf penuh; siswa hanya kartunya sendiri;
     * orang tua hanya anak yang tertaut lewat pivot guardian_student.
     */
    public function viewKtsCard(User $user, Student $student): bool
    {
        if ($user->hasAnyRole(['super_admin', 'admin_tu', 'operator', 'guru'])) {
            return true;
        }

        if ($user->hasRole('siswa')) {
            return $user->student?->id === $student->id;
        }

        if ($user->hasRole('orang_tua')) {
            return Guardian::query()
                ->where('user_id', $user->id)
                ->whereHas('students', fn ($q) => $q->whereKey($student->id))
                ->exists();
        }

        return false;
    }

    public function sendBroadcast(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function manageNotifications(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function manageSettings(User $user): bool
    {
        return $user->hasRole('super_admin');
    }
}
