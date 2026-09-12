<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\CbtExam;
use App\Models\Student;

/**
 * Single-responsibility service agregasi ringkasan dashboard staf.
 * Angka dihitung di server — bukan mock/estimasi di klien.
 */
class DashboardService
{
    /** @return array{total_students: int, attendance_today: int, attendance_rate: int, active_cbt_exams: int, trend_30d: array<int, array{date: string, hadir: int}>, per_kelas: array<int, array{kelas: string, siswa: int, hadir_hari_ini: int}>} */
    public function summary(): array
    {
        $today = now(config('school.timezone', 'Asia/Jakarta'))->format('Y-m-d');

        $totalStudents = Student::query()->where('status', 'active')->count();
        $attendanceToday = Attendance::query()->whereDate('date', $today)->count();

        // Tren 30 hari: 1 query agregasi (tanpa N+1), label tanggal ISO.
        $since = now(config('school.timezone', 'Asia/Jakarta'))->subDays(29)->format('Y-m-d');
        $trend = Attendance::query()
            ->selectRaw('DATE(date) as d, COUNT(*) as hadir')
            ->whereDate('date', '>=', $since)
            ->groupBy('d')
            ->orderBy('d')
            ->pluck('hadir', 'd');

        $trend30d = [];
        for ($i = 29; $i >= 0; $i--) {
            $day = now(config('school.timezone', 'Asia/Jakarta'))->subDays($i)->format('Y-m-d');
            $trend30d[] = ['date' => $day, 'hadir' => (int) ($trend[$day] ?? 0)];
        }

        // Agregasi per kelas hari ini: eager count via join (2 query ringan, bukan N+1).
        $studentsPerKelas = Student::query()->where('status', 'active')
            ->leftJoin('class_rooms', 'class_rooms.id', '=', 'students.class_room_id')
            ->selectRaw('COALESCE(class_rooms.name, students.id) as kelas, COUNT(students.id) as siswa')
            ->groupBy('kelas')
            ->pluck('siswa', 'kelas');

        $hadirPerKelas = Attendance::query()
            ->whereDate('date', $today)
            ->join('students', 'students.id', '=', 'attendances.student_id')
            ->leftJoin('class_rooms', 'class_rooms.id', '=', 'students.class_room_id')
            ->selectRaw('COALESCE(class_rooms.name, students.id) as kelas, COUNT(attendances.id) as hadir')
            ->groupBy('kelas')
            ->pluck('hadir', 'kelas');

        $perKelas = [];
        foreach ($studentsPerKelas as $kelas => $siswa) {
            $perKelas[] = [
                'kelas' => (string) $kelas,
                'siswa' => (int) $siswa,
                'hadir_hari_ini' => (int) ($hadirPerKelas[$kelas] ?? 0),
            ];
        }

        return [
            'total_students' => $totalStudents,
            'attendance_today' => $attendanceToday,
            'attendance_rate' => $totalStudents > 0
                ? (int) round($attendanceToday / $totalStudents * 100)
                : 0,
            'active_cbt_exams' => CbtExam::query()->where('status', CbtExam::STATUS_PUBLISHED)->count(),
            'trend_30d' => $trend30d,
            'per_kelas' => $perKelas,
        ];
    }
}
