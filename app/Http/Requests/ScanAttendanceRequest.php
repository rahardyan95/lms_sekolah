<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ScanAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('attendance.scan') || $this->user()->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }

    public function rules(): array
    {
        return [
            'nisn' => ['required', 'string', 'max:20'],
            'date' => ['required', 'date'],
            'device' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
        ];
    }
}
