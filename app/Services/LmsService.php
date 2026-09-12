<?php

namespace App\Services;

use App\Enums\AttendanceStatus;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * LMS: materi privat, tugas + pengumpulan berdeadline jam server,
 * penilaian massal transaksional dengan predikat otomatis.
 */
class LmsService
{
    /**
     * Ringkasan header portal siswa: persentase kehadiran bulan berjalan
     * (hadir+terlambat / hari sekolah) dan rata-rata nilai akhir yang dipublikasi.
     *
     * @return array{nisn: string, name: string, class_name: string, major: string, attendance_percentage: float, average_grade: float}
     */
    public function studentSummary(Student $student): array
    {
        // Tanggal presensi dicatat dalam zona sekolah (Asia/Jakarta), sedangkan
        // app.timezone = UTC — batas bulan/hari harus memakai zona yang sama,
        // jika tidak persentase kehadiran meleset 7 jam pertama tiap hari.
        $tz = config('school.timezone', 'Asia/Jakarta');
        $start = Carbon::now($tz)->startOfMonth();
        $today = Carbon::now($tz);

        $present = Attendance::query()
            ->where('student_id', $student->id)
            ->whereBetween('date', [$start->toDateString(), $today->toDateString()])
            ->whereIn('status', [AttendanceStatus::Hadir->value, AttendanceStatus::Terlambat->value])
            ->count();

        // Hari sekolah = hari kerja (Sen–Jum) yang sudah berjalan bulan ini.
        $schoolDays = 0;
        for ($day = $start->copy(); $day->lte($today); $day->addDay()) {
            if ($day->isWeekday()) {
                $schoolDays++;
            }
        }

        $average = Grade::query()
            ->where('student_id', $student->id)
            ->where('published', true)
            ->avg('nilai_akhir');

        return [
            'nisn' => (string) $student->nisn,
            'name' => (string) $student->name,
            'class_name' => (string) ($student->classRoom?->name ?? ''),
            'major' => (string) ($student->classRoom?->major ?? ''),
            'attendance_percentage' => $schoolDays > 0 ? round($present / $schoolDays * 100, 1) : 0.0,
            'average_grade' => $average !== null ? round((float) $average, 2) : 0.0,
        ];
    }

    /** @return array{created: int, updated: int} */
    public function bulkGrades(Subject $subject, array $rows, bool $publish): array
    {
        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($subject, $rows, $publish, &$created, &$updated) {
            foreach ($rows as $row) {
                $computed = Grade::compute((int) $row['nilai_tugas'], (int) $row['nilai_uts'], (int) $row['nilai_uas']);

                $grade = Grade::updateOrCreate(
                    ['student_id' => $row['student_id'], 'subject_id' => $subject->id],
                    [
                        'nilai_tugas' => $row['nilai_tugas'],
                        'nilai_uts' => $row['nilai_uts'],
                        'nilai_uas' => $row['nilai_uas'],
                        'nilai_akhir' => $computed['nilai_akhir'],
                        'predikat' => $computed['predikat'],
                        'catatan_guru' => $row['catatan_guru'] ?? null,
                        'published' => $publish,
                    ]
                );

                $grade->wasRecentlyCreated ? $created++ : $updated++;
            }
        });

        return ['created' => $created, 'updated' => $updated];
    }

    public function submit(User $user, Assignment $assignment, UploadedFile $file): Submission
    {
        $student = $user->student;

        if (! $student) {
            throw new HttpException(422, 'Akun belum tertaut ke data siswa.');
        }

        if ($assignment->isClosed()) {
            throw new HttpException(422, 'Tenggat pengumpulan sudah ditutup.');
        }

        $existing = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->first();

        if ($existing && $existing->status === 'graded') {
            throw new HttpException(422, 'Tugas sudah dinilai, tidak bisa diubah.');
        }

        // Seluruh validasi bisnis selesai SEBELUM berkas ditulis ke disk:
        // pengumpulan yang ditolak tidak boleh meninggalkan berkas yatim.
        $path = $file->store('lms/submissions', 'local');

        // Lewat tenggat tetapi belum ditutup → tetap diterima, ditandai 'late'
        // supaya guru melihat mana yang terlambat (FRD §9).
        $status = $assignment->isOpen() ? 'submitted' : 'late';

        return DB::transaction(function () use ($assignment, $student, $file, $path, $status) {
            $fresh = Submission::where('assignment_id', $assignment->id)
                ->where('student_id', $student->id)
                ->first();

            // Cek ulang di dalam transaksi: status bisa berubah setelah cek awal.
            if ($fresh && $fresh->status === 'graded') {
                throw new HttpException(422, 'Tugas sudah dinilai, tidak bisa diubah.');
            }

            $attributes = [
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime' => $file->getMimeType() ?? 'application/octet-stream',
                'size' => $file->getSize() ?? 0,
                'submitted_at' => now(),
                'status' => $status,
            ];

            if ($fresh) {
                $previous = $fresh->path;
                $fresh->update($attributes);

                // Pengumpulan ulang mengganti berkas: yang lama dihapus agar
                // tidak menumpuk sebagai berkas yatim di disk.
                if ($previous && $previous !== $path) {
                    Storage::disk('local')->delete($previous);
                }

                return $fresh->refresh();
            }

            return Submission::create($attributes + [
                'assignment_id' => $assignment->id,
                'student_id' => $student->id,
            ]);
        });
    }

    public function grade(Submission $submission, ?int $score, ?string $feedback): Submission
    {
        $submission->update([
            'score' => $score,
            'feedback' => $feedback,
            'status' => 'graded',
        ]);

        return $submission->refresh();
    }
}
