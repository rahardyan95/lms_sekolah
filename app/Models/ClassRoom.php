<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassRoom extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['name', 'grade', 'major', 'academic_year_id'];

    public function students()
    {
        return $this->hasMany(Student::class);
    }
}
