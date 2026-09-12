<?php

namespace App\Http\Resources;

use App\Models\CbtExam;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Daftar ujian untuk peserta: TANPA kunci & pembahasan.
 * $hidden di model melapis kedua, resource ini lapis pertama.
 *
 * @mixin CbtExam
 */
class CbtExamResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'subject_name' => $this->subject_name,
            'kelas' => $this->kelas,
            'duration_minutes' => $this->duration_minutes,
            'total_questions' => $this->whenCounted('questions', fn () => $this->questions_count, fn () => $this->questions->count()),
            'date' => $this->date->format('Y-m-d'),
            'time_start' => $this->time_start,
            'time_end' => $this->time_end,
            'status' => $this->status,
            'is_open' => $this->isOpenNow(),
            'questions' => $this->questions->map(fn ($q) => [
                'id' => $q->id,
                'number' => $q->number,
                'question' => $q->question,
                'options' => $q->options,
            ])->values(),
        ];
    }
}
