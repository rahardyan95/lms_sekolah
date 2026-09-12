<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveCbtAnswerRequest;
use App\Http\Requests\StoreCbtExamRequest;
use App\Http\Resources\CbtAttemptResource;
use App\Http\Resources\CbtExamResource;
use App\Models\CbtAttempt;
use App\Models\CbtExam;
use App\Models\CbtQuestion;
use App\Services\CbtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CbtController extends Controller
{
    public function __construct(protected CbtService $service) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isManager = $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);

        $exams = CbtExam::with('questions')
            ->where('status', CbtExam::STATUS_PUBLISHED)
            // Non-manajer hanya melihat ujian kelasnya; peserta tanpa kelas: kosong.
            ->when(! $isManager, fn ($q) => $q->where('kelas', $user->student?->classRoom?->name ?? '__none__'))
            ->orderBy('date')
            ->get();

        return $this->envelope($request, CbtExamResource::collection($exams));
    }

    public function store(StoreCbtExamRequest $request): JsonResponse
    {
        $exam = $this->service->createExam($request->user(), $request->validated());

        // Publikasi saat create: soal sudah divalidasi ≥1, policy menjaga izinnya.
        if ($exam->status === CbtExam::STATUS_PUBLISHED) {
            $this->authorize('publish', $exam);
        }

        return $this->envelope($request, new CbtExamResource($exam), 201);
    }

    /** Transisi status ujian; draft → published hanya bila sudah ada soal. */
    public function updateStatus(Request $request, CbtExam $exam): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:draft,published,closed'],
        ]);

        if ($data['status'] === CbtExam::STATUS_PUBLISHED) {
            $this->authorize('publish', $exam);
        } else {
            $this->authorize('manage', CbtExam::class);
        }

        $exam->update(['status' => $data['status']]);

        return $this->envelope($request, new CbtExamResource($exam->refresh()));
    }

    public function start(Request $request, CbtExam $exam): JsonResponse
    {
        $this->authorize('attempt', CbtExam::class);
        $this->authorize('viewExam', $exam);

        $attempt = $this->service->startAttempt($request->user(), $exam->load('questions'));

        return $this->envelope($request, new CbtAttemptResource($attempt->load('exam.questions', 'answers')), 201);
    }

    public function answer(SaveCbtAnswerRequest $request, CbtAttempt $attempt): JsonResponse
    {
        $this->authorize('viewAttempt', $attempt);

        $question = CbtQuestion::findOrFail($request->string('question_id'));
        $answer = $this->service->saveAnswer(
            $request->user(),
            $attempt->load('exam.questions'),
            $question,
            $request->string('answer'),
            (bool) $request->boolean('hesitant'),
        );

        return $this->envelope($request, $answer);
    }

    public function submit(Request $request, CbtAttempt $attempt): JsonResponse
    {
        $this->authorize('viewAttempt', $attempt);

        $result = $this->service->submitAttempt(
            $request->user(),
            $attempt->load('exam.questions', 'answers'),
        );

        return $this->envelope($request, [
            'attempt' => new CbtAttemptResource($result['attempt']->load('exam.questions', 'answers')),
            'correct' => $result['correct'],
            'wrong' => $result['wrong'],
            'total' => $result['total'],
            'score' => $result['score'],
        ]);
    }

    public function show(Request $request, CbtAttempt $attempt): JsonResponse
    {
        $this->authorize('viewAttempt', $attempt);

        return $this->envelope($request, new CbtAttemptResource($attempt->load('exam.questions', 'answers')));
    }
}
