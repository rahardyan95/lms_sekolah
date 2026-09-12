<?php

namespace App\Services;

use App\Models\CbtAnswer;
use App\Models\CbtAttempt;
use App\Models\CbtExam;
use App\Models\CbtQuestion;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Server-side CBT: attempt + deadline jam server, autosave idempotent,
 * grading di server. Kunci jawaban tidak pernah keluar dari service ini
 * kecuali ke hasil milik peserta yang sudah submit.
 */
class CbtService
{
    public function createExam(User $author, array $data): CbtExam
    {
        return DB::transaction(function () use ($author, $data) {
            $exam = CbtExam::create([
                'title' => $data['title'],
                'subject_name' => $data['subject_name'],
                'kelas' => $data['kelas'],
                'duration_minutes' => $data['duration_minutes'],
                'date' => $data['date'],
                'time_start' => $data['time_start'],
                'time_end' => $data['time_end'],
                'status' => $data['status'] ?? CbtExam::STATUS_DRAFT,
                'created_by' => $author->id,
            ]);

            foreach (array_values($data['questions']) as $i => $q) {
                $exam->questions()->create([
                    'number' => $i + 1,
                    'question' => $q['question'],
                    'options' => $q['options'],
                    'correct_answer' => $q['correct_answer'],
                    'explanation' => $q['explanation'] ?? null,
                ]);
            }

            return $exam->load('questions');
        });
    }

    public function startAttempt(User $user, CbtExam $exam): CbtAttempt
    {
        if (! $exam->isOpenNow()) {
            throw new HttpException(422, 'Ujian belum dibuka atau jendela waktu sudah tutup.');
        }

        return DB::transaction(function () use ($user, $exam) {
            // Satu attempt per (exam, user): attempt kedaluwarsa tetap milik peserta,
            // bukan kesempatan kedua dengan deadline baru.
            $existing = CbtAttempt::where('exam_id', $exam->id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing->load('answers');
            }

            $now = now();

            try {
                return CbtAttempt::create([
                    'exam_id' => $exam->id,
                    'user_id' => $user->id,
                    'student_id' => $user->student?->id,
                    'started_at' => $now,
                    'deadline_at' => $now->copy()->addMinutes($exam->duration_minutes),
                ]);
            } catch (UniqueConstraintViolationException) {
                // Double-tap "Mulai": request kedua kalah di unique(exam,user) —
                // kembalikan attempt yang sudah dibuat (idempotent), bukan 500.
                return CbtAttempt::where('exam_id', $exam->id)
                    ->where('user_id', $user->id)
                    ->firstOrFail()
                    ->load('answers');
            }
        });
    }

    public function saveAnswer(User $user, CbtAttempt $attempt, CbtQuestion $question, string $answer, bool $hesitant): CbtAnswer
    {
        $this->assertWritable($attempt, $question);

        if ($attempt->user_id !== $user->id) {
            abort(403, 'Attempt milik peserta lain.');
        }

        return CbtAnswer::updateOrCreate(
            ['attempt_id' => $attempt->id, 'question_id' => $question->id],
            ['answer' => $answer, 'hesitant' => $hesitant]
        );
    }

    /** @return array{attempt: CbtAttempt, correct: int, wrong: int, total: int, score: int} */
    public function submitAttempt(User $user, CbtAttempt $attempt): array
    {
        if ($attempt->user_id !== $user->id) {
            abort(403, 'Attempt milik peserta lain.');
        }

        return DB::transaction(fn () => $this->gradeAttempt($attempt));
    }

    /**
     * Auto-submit percobaan yang deadline-nya lewat (dipanggil scheduler).
     * Tidak butuh sesi peserta; grading idempotent sehingga aman dijalankan
     * berulang — attempt yang sudah dikumpulkan dikembalikan apa adanya.
     */
    public function autoSubmitAttempt(CbtAttempt $attempt): array
    {
        return DB::transaction(fn () => $this->gradeAttempt($attempt));
    }

    /** @return array{attempt: CbtAttempt, correct: int, wrong: int, total: int, score: int} */
    private function gradeAttempt(CbtAttempt $attempt): array
    {
        $attempt->refresh();

        if ($attempt->isSubmitted()) {
            return $this->result($attempt);
        }

        $questions = $attempt->exam->questions;
        $answers = $attempt->answers()->get()->keyBy('question_id');

        $correct = 0;
        foreach ($questions as $q) {
            if (($answers->get($q->id)?->answer) === $q->correct_answer) {
                $correct++;
            }
        }

        $total = $questions->count();
        $score = $total > 0 ? (int) round($correct / $total * 100) : 0;

        $attempt->update(['submitted_at' => now(), 'score' => $score]);

        return $this->result($attempt->refresh());
    }

    /** @return array{attempt: CbtAttempt, correct: int, wrong: int, total: int, score: int} */
    public function result(CbtAttempt $attempt): array
    {
        $questions = $attempt->exam->questions;
        $answers = $attempt->answers()->get()->keyBy('question_id');

        $correct = 0;
        foreach ($questions as $q) {
            if (($answers->get($q->id)?->answer) === $q->correct_answer) {
                $correct++;
            }
        }

        $total = $questions->count();

        return [
            'attempt' => $attempt,
            'correct' => $correct,
            'wrong' => $total - $correct,
            'total' => $total,
            'score' => $attempt->score ?? ($total > 0 ? (int) round($correct / $total * 100) : 0),
        ];
    }

    private function assertWritable(CbtAttempt $attempt, CbtQuestion $question): void
    {
        if ($question->exam_id !== $attempt->exam_id) {
            abort(422, 'Soal bukan bagian dari attempt ini.');
        }

        if ($attempt->isSubmitted()) {
            abort(422, 'Attempt sudah dikumpulkan, jawaban terkunci.');
        }

        if ($attempt->isExpired()) {
            abort(422, 'Waktu pengerjaan habis, attempt kedaluwarsa.');
        }
    }
}
