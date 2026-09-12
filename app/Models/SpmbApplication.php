<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpmbApplication extends Model
{
    use HasFactory, HasUlids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'registration_number', 'wave_id', 'name', 'nisn', 'nik', 'gender',
        'birth_place', 'birth_date', 'parent_name', 'parent_phone',
        'previous_school', 'average_score', 'chosen_major', 'status',
        'verified_by', 'verified_at', 'notes', 'converted_student_id',
    ];

    protected $hidden = ['nik', 'parent_phone'];

    protected $casts = [
        'birth_date' => 'date',
        'average_score' => 'decimal:2',
        'verified_at' => 'datetime',
        'nik' => 'encrypted',
        'parent_phone' => 'encrypted',
    ];

    public function wave(): BelongsTo
    {
        return $this->belongsTo(SpmbWave::class, 'wave_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(SpmbFile::class, 'application_id');
    }

    public function convertedStudent(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'converted_student_id');
    }
}
