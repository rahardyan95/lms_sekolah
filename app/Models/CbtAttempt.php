<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CbtAttempt extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'exam_id', 'user_id', 'student_id',
        'started_at', 'deadline_at', 'submitted_at', 'score',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'deadline_at' => 'datetime',
        'submitted_at' => 'datetime',
        'score' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(CbtExam::class, 'exam_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(CbtAnswer::class, 'attempt_id');
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    public function isExpired(): bool
    {
        return ! $this->isSubmitted() && now()->greaterThan($this->deadline_at);
    }
}
