<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CbtAnswer extends Model
{
    use HasFactory, HasUlids;

    public const OPTIONS = ['A', 'B', 'C', 'D', 'E'];

    protected $fillable = ['attempt_id', 'question_id', 'answer', 'hesitant'];

    protected $casts = ['hesitant' => 'boolean'];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(CbtAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CbtQuestion::class, 'question_id');
    }
}
