<?php

namespace App\Http\Requests;

use App\Enums\AttendanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class ManualAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('attendance.manual')
            || $this->user()->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }

    public function rules(): array
    {
        return [
            'nisn' => ['required', 'string', 'max:20', 'exists:students,nisn'],
            'date' => ['required', 'date'],
            'status' => ['required', new Enum(AttendanceStatus::class)],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
