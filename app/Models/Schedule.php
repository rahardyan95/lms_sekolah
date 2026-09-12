<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Schedule extends Model
{
    use HasFactory, HasUlids;

    public const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    protected $fillable = [
        'day', 'time_start', 'time_end', 'kelas',
        'subject_id', 'subject_name', 'teacher_name', 'room',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function overlaps(string $day, string $kelas, string $start, string $end, ?string $ignoreId = null): bool
    {
        return static::query()
            ->where('day', $day)->where('kelas', $kelas)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('time_start', '<', $end)
            ->where('time_end', '>', $start)
            ->exists();
    }
}
