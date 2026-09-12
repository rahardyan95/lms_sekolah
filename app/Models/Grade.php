<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Grade extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'student_id', 'subject_id', 'nilai_tugas', 'nilai_uts',
        'nilai_uas', 'nilai_akhir', 'predikat', 'catatan_guru', 'published',
    ];

    protected $casts = [
        'nilai_tugas' => 'integer', 'nilai_uts' => 'integer',
        'nilai_uas' => 'integer', 'nilai_akhir' => 'integer',
        'published' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public static function compute(int $tugas, int $uts, int $uas): array
    {
        $akhir = (int) round(($tugas + $uts + $uas) / 3);

        return [
            'nilai_akhir' => $akhir,
            'predikat' => $akhir >= 90 ? 'A' : ($akhir >= 80 ? 'B' : ($akhir >= 70 ? 'C' : 'D')),
        ];
    }
}
