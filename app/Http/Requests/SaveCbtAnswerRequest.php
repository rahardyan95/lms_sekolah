<?php

namespace App\Http\Requests;

use App\Models\CbtAnswer;
use App\Models\CbtExam;
use Illuminate\Foundation\Http\FormRequest;

class SaveCbtAnswerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('attempt', CbtExam::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'question_id' => ['required', 'string', 'exists:cbt_questions,id'],
            'answer' => ['required', 'in:'.implode(',', CbtAnswer::OPTIONS)],
            'hesitant' => ['nullable', 'boolean'],
        ];
    }
}
