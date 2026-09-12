<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CbtQuestion extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'exam_id', 'number', 'question', 'options', 'correct_answer', 'explanation',
    ];

    protected $casts = [
        'options' => 'array',
        'number' => 'integer',
    ];

    /** Kunci + pembahasan TIDAK boleh ikut serialisasi API publik. */
    protected $hidden = ['correct_answer', 'explanation'];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(CbtExam::class, 'exam_id');
    }
}
