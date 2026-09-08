<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'student_id', 'date', 'time_in', 'time_out',
        'status', 'source', 'operator_id', 'device', 'idempotency_key',
    ];

    protected $casts = ['status' => AttendanceStatus::class];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
