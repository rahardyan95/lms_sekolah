<?php

namespace App\Services;

use App\Models\Attendance;
use Generator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Single-responsibility service laporan presensi.
 * Dipakai endpoint halaman (reports) dan ekspor CSV (streaming, hemat memori).
 */
class AttendanceReportService
{
    /** Batas rentang ekspor agar satu request tidak menarik data tak terbatas. */
    public const MAX_EXPORT_DAYS = 92;

    /** @return Builder<Attendance> */
    public function query(array $filters)
    {
        return Attendance::with('student.classRoom')
            ->whereBetween('date', [$filters['from'], $filters['to']])
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when(
                $filters['class_room_id'] ?? null,
                fn ($q, $c) => $q->whereHas('student', fn ($s) => $s->where('class_room_id', $c))
            )
            ->orderBy('date')
            ->orderBy('time_in');
    }

    /**
     * Baris CSV sebagai generator (tidak menampung seluruh hasil di memori).
     *
     * @return Generator<int, array<int, string>>
     */
    public function csvRows(array $filters): Generator
    {
        yield ['Tanggal', 'NISN', 'Nama', 'Kelas', 'Status', 'Jam Masuk', 'Jam Pulang', 'Sumber'];

        foreach ($this->query($filters)->lazy(500) as $attendance) {
            yield [
                (string) $attendance->date,
                (string) ($attendance->student?->nisn ?? ''),
                (string) ($attendance->student?->name ?? ''),
                (string) ($attendance->student?->classRoom?->name ?? ''),
                $attendance->status?->value ?? '',
                (string) ($attendance->time_in ?? ''),
                (string) ($attendance->time_out ?? ''),
                (string) $attendance->source,
            ];
        }
    }

    /**
     * Rekap per siswa untuk laporan PDF: jumlah tiap status + persentase
     * kehadiran (hadir+terlambat dibagi seluruh catatan siswa tersebut).
     * Memakai `lazy()` agar rentang panjang tidak menahan seluruh baris di memori.
     *
     * @return array<int, array{nisn: string, name: string, hadir: int, terlambat: int, sakit: int, izin: int, alpa: int, percentage: float}>
     */
    public function reportRows(array $filters): array
    {
        $rows = [];

        foreach ($this->query($filters)->lazy(500) as $attendance) {
            $student = $attendance->student;
            $key = (string) ($student?->id ?? 'unknown');

            $rows[$key] ??= [
                'nisn' => (string) ($student?->nisn ?? ''),
                'name' => (string) ($student?->name ?? ''),
                'hadir' => 0,
                'terlambat' => 0,
                'sakit' => 0,
                'izin' => 0,
                'alpa' => 0,
            ];

            $status = $attendance->status?->value;

            if ($status !== null && array_key_exists($status, $rows[$key])) {
                $rows[$key][$status]++;
            }
        }

        return array_values(array_map(function (array $row): array {
            $total = $row['hadir'] + $row['terlambat'] + $row['sakit'] + $row['izin'] + $row['alpa'];
            $row['percentage'] = $total > 0
                ? round(($row['hadir'] + $row['terlambat']) / $total * 100, 1)
                : 0.0;

            return $row;
        }, $rows));
    }

    /**
     * Cegah CSV formula injection: nilai yang dimulai karakter berbahaya
     * bagi spreadsheet (=, +, -, @, tab, CR) diberi prefix apostrof.
     */
    public function sanitizeCell(string $value): string
    {
        return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }
}
