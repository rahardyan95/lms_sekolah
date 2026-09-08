<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id', 'nisn', 'nik', 'name', 'gender',
        'birth_place', 'birth_date', 'photo_path',
        'class_room_id', 'status',
    ];

    protected $hidden = ['nik'];

    protected $casts = ['birth_date' => 'date'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function classRoom()
    {
        return $this->belongsTo(ClassRoom::class);
    }

    public function guardians()
    {
        return $this->belongsToMany(Guardian::class, 'guardian_student');
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }
}
