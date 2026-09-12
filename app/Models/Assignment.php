<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['subject_id', 'title', 'description', 'deadline', 'closed_at', 'kelas', 'created_by'];

    protected $casts = ['deadline' => 'datetime', 'closed_at' => 'datetime'];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'assignment_id');
    }

    /** Masih dalam tenggat (pengumpulan tepat waktu). */
    public function isOpen(): bool
    {
        return $this->closed_at === null && now()->lessThanOrEqualTo($this->deadline);
    }

    /** Ditutup eksplisit oleh guru — hanya ini yang menolak pengumpulan. */
    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }

    /** Tenggat terlewat tetapi belum ditutup → pengumpulan diterima sebagai 'late'. */
    public function isLate(): bool
    {
        return ! $this->isClosed() && now()->greaterThan($this->deadline);
    }
}
