<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Submission extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'assignment_id', 'student_id', 'path', 'original_name',
        'mime', 'size', 'submitted_at', 'score', 'feedback', 'status',
    ];

    protected $casts = ['size' => 'integer', 'submitted_at' => 'datetime', 'score' => 'integer'];

    protected $hidden = ['path'];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
