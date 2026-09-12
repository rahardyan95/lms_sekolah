<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Guardian extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['user_id', 'name', 'phone', 'email', 'status'];

    protected $hidden = ['phone'];

    protected $casts = ['phone' => 'encrypted'];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function students()
    {
        return $this->belongsToMany(Student::class, 'guardian_student');
    }
}
