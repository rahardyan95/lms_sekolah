<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CbtExam extends Model
{
    use HasFactory, HasUlids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'title', 'subject_name', 'kelas', 'duration_minutes',
        'date', 'time_start', 'time_end', 'status', 'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'duration_minutes' => 'integer',
    ];

    public function questions(): HasMany
    {
        return $this->hasMany(CbtQuestion::class, 'exam_id')->orderBy('number');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(CbtAttempt::class, 'exam_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isOpenNow(): bool
    {
        if ($this->status !== self::STATUS_PUBLISHED) {
            return false;
        }

        $tz = config('school.timezone', 'Asia/Jakarta');
        $now = now($tz);

        if ($this->date->format('Y-m-d') !== $now->format('Y-m-d')) {
            return false;
        }

        $time = $now->format('H:i');

        return $time >= $this->time_start && $time < $this->time_end;
    }
}
