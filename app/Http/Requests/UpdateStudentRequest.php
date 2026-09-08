<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function rules(): array
    {
        return [
            'nisn' => ['sometimes', 'string', 'max:20', Rule::unique('students', 'nisn')->ignore($this->route('student'))],
            'nik' => ['nullable', 'string', 'max:64'],
            'name' => ['sometimes', 'string', 'max:255'],
            'gender' => ['nullable', 'string', 'max:16'],
            'birth_place' => ['nullable', 'string', 'max:255'],
            'birth_date' => ['nullable', 'date'],
            'class_room_id' => ['nullable', 'string', 'exists:class_rooms,id'],
            'status' => ['sometimes', 'string', 'in:active,inactive'],
        ];
    }
}
