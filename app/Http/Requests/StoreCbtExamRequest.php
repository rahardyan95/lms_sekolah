<?php

namespace App\Http\Requests;

use App\Models\CbtExam;
use Illuminate\Foundation\Http\FormRequest;

class StoreCbtExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage', CbtExam::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'subject_name' => ['required', 'string', 'max:255'],
            'kelas' => ['required', 'string', 'max:64'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:480'],
            'date' => ['required', 'date'],
            'time_start' => ['required', 'date_format:H:i'],
            'time_end' => ['required', 'date_format:H:i', 'after:time_start'],
            'status' => ['nullable', 'in:draft,published,closed'],
            'questions' => ['required', 'array', 'min:1', 'max:100'],
            'questions.*.question' => ['required', 'string'],
            'questions.*.options' => ['required', 'array'],
            'questions.*.options.A' => ['required', 'string'],
            'questions.*.options.B' => ['required', 'string'],
            'questions.*.options.C' => ['required', 'string'],
            'questions.*.options.D' => ['required', 'string'],
            'questions.*.options.E' => ['required', 'string'],
            'questions.*.correct_answer' => ['required', 'in:A,B,C,D,E'],
            'questions.*.explanation' => ['nullable', 'string'],
        ];
    }
}
