<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademicYear extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['label', 'starts_at', 'ends_at', 'active'];

    protected $casts = [
        'starts_at' => 'date',
        'ends_at' => 'date',
        'active' => 'boolean',
    ];

    public function classRooms()
    {
        return $this->hasMany(ClassRoom::class);
    }
}
