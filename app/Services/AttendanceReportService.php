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
     * Cegah CSV formula injection: nilai yang dimulai karakter berbahaya
     * bagi spreadsheet (=, +, -, @, tab, CR) diberi prefix apostrof.
     */
    public function sanitizeCell(string $value): string
    {
        return preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }
}
