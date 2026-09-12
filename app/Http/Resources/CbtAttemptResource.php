<?php

namespace App\Http\Resources;

use App\Models\CbtAttempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Attempt milik peserta: state jawaban + deadline server.
 * Kunci tidak pernah muncul; pembahasan hanya pasca-submit.
 *
 * @mixin CbtAttempt
 */
class CbtAttemptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $answers = $this->answers->keyBy('question_id');
        $showKeys = $this->isSubmitted();

        return [
            'id' => $this->id,
            'exam_id' => $this->exam_id,
            'started_at' => $this->started_at->toIso8601String(),
            'deadline_at' => $this->deadline_at->toIso8601String(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'score' => $this->score,
            'seconds_remaining' => max(0, now()->diffInSeconds($this->deadline_at, false)),
            'questions' => $this->exam->questions->map(function ($q) use ($answers, $showKeys) {
                $saved = $answers->get($q->id);
                $row = [
                    'id' => $q->id,
                    'number' => $q->number,
                    'question' => $q->question,
                    'options' => $q->options,
                    'answer' => $saved?->answer,
                    'hesitant' => (bool) ($saved?->hesitant ?? false),
                ];

                if ($showKeys) {
                    $row['correct_answer'] = $q->correct_answer;
                    $row['explanation'] = $q->explanation;
                }

                return $row;
            })->values(),
        ];
    }
}
