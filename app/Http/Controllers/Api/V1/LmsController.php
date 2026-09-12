<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Grade;
use App\Models\Material;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use App\Services\LmsService;
use App\Support\SignedDownload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LmsController extends Controller
{
    public function __construct(protected LmsService $service) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    private function classScope(Request $request, $query, string $column = 'kelas')
    {
        $user = $request->user();

        if ($this->manageAny($user)) {
            return $query; // staf melihat seluruh kelas
        }

        $kelas = $user->student?->classRoom?->name;

        if ($kelas === null) {
            return $query->whereRaw('1 = 0'); // peserta tanpa kelas: tidak ada yang boleh dilihat
        }

        return $query->where(fn ($q) => $q->whereNull($column)->orWhere($column, $kelas));
    }

    private function manageAny(?User $user): bool
    {
        return $user !== null && $user->hasAnyRole(['super_admin', 'admin_tu', 'guru']);
    }

    // --- Subjects ---
    public function subjects(Request $request): JsonResponse
    {
        $this->authorize('viewMasterData');

        return $this->envelope($request, Subject::orderBy('name')->paginate(25));
    }

    public function storeSubject(Request $request): JsonResponse
    {
        $this->authorize('manage', Subject::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:subjects,code'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:32'],
            'kkm' => ['nullable', 'integer', 'min:0', 'max:100'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        return $this->envelope($request, Subject::create($data), 201);
    }

    // --- Materials ---
    public function materials(Request $request): JsonResponse
    {
        $this->authorize('viewAnyMaterial', Material::class);

        $materials = $this->classScope($request, Material::with('subject:id,code,name'))
            ->orderByDesc('created_at')
            ->paginate(25)
            // Link unduh bertanda tangan & berumur pendek (bukan path mentah).
            ->through(function (Material $material) {
                $material->setAttribute(
                    'download_url',
                    $material->path ? SignedDownload::url('lms.materials.download', ['material' => $material->id]) : null
                );

                return $material;
            });

        return $this->envelope($request, $materials);
    }

    public function storeMaterial(Request $request): JsonResponse
    {
        $this->authorize('manage', Material::class);

        $data = $request->validate([
            'subject_id' => ['nullable', 'string', 'exists:subjects,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'file_type' => ['required', 'in:'.implode(',', Material::FILE_TYPES)],
            'kelas' => ['nullable', 'string', 'max:64'],
            'file' => ['nullable', 'file', 'max:20480', 'mimes:pdf,doc,docx,ppt,pptx,mp4'],
        ]);

        $stored = [];
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $stored = [
                'path' => $file->store('lms/materials', 'local'),
                'original_name' => $file->getClientOriginalName(),
                'size' => $file->getSize() ?? 0,
            ];
        }

        $material = Material::create([
            'subject_id' => $data['subject_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'file_type' => $data['file_type'],
            'kelas' => $data['kelas'] ?? null,
            'author_id' => $request->user()->id,
            ...$stored,
        ]);

        return $this->envelope($request, $material, 201);
    }

    public function downloadMaterial(Request $request, Material $material)
    {
        $this->authorize('viewMaterial', $material);

        if (! $material->path) {
            abort(404, 'Materi tanpa berkas.');
        }

        return Storage::disk('local')->download($material->path, $material->original_name ?? 'materi');
    }

    // --- Assignments ---
    public function assignments(Request $request): JsonResponse
    {
        $this->authorize('viewAnyAssignment', Assignment::class);

        $assignments = $this->classScope($request, Assignment::with('subject:id,code,name'))
            ->orderBy('deadline')->paginate(25);

        return $this->envelope($request, $assignments);
    }

    public function storeAssignment(Request $request): JsonResponse
    {
        $this->authorize('manage', Assignment::class);

        $data = $request->validate([
            'subject_id' => ['required', 'string', 'exists:subjects,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'deadline' => ['required', 'date', 'after:now'],
            'kelas' => ['nullable', 'string', 'max:64'],
        ]);

        return $this->envelope($request, Assignment::create([
            ...$data, 'created_by' => $request->user()->id,
        ]), 201);
    }

    public function submit(Request $request, Assignment $assignment): JsonResponse
    {
        $this->authorize('submitAssignment', $assignment);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,doc,docx,zip,jpg,jpeg,png'],
        ]);

        $submission = $this->service->submit($request->user(), $assignment, $data['file']);

        return $this->envelope($request, $submission, 201);
    }

    public function submissions(Request $request, Assignment $assignment): JsonResponse
    {
        $this->authorize('manage', Assignment::class);

        return $this->envelope($request, $assignment->submissions()->with('student:id,nisn,name')->paginate(25));
    }

    public function gradeSubmission(Request $request, Submission $submission): JsonResponse
    {
        $this->authorize('manage', Assignment::class);

        $data = $request->validate([
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->envelope($request, $this->service->grade($submission, $data['score'] ?? null, $data['feedback'] ?? null));
    }

    // --- Grades ---
    public function myGrades(Request $request): JsonResponse
    {
        $student = $request->user()->student;

        if (! $student) {
            return $this->envelope($request, []);
        }

        $grades = Grade::with('subject:id,code,name,kkm')
            ->where('student_id', $student->id)
            ->where('published', true)
            ->get();

        return $this->envelope($request, $grades);
    }

    public function mySummary(Request $request): JsonResponse
    {
        $student = $request->user()->student;

        // Null-safe: akun tanpa data siswa mengembalikan nol, bukan 500.
        return $this->envelope($request, $student
            ? $this->service->studentSummary($student)
            : [
                'nisn' => '',
                'name' => '',
                'class_name' => '',
                'major' => '',
                'attendance_percentage' => 0.0,
                'average_grade' => 0.0,
            ]);
    }

    public function bulkGrades(Request $request, Subject $subject): JsonResponse
    {
        $this->authorize('manage', Assignment::class);

        $data = $request->validate([
            'publish' => ['nullable', 'boolean'],
            'rows' => ['required', 'array', 'min:1', 'max:500'],
            'rows.*.student_id' => ['required', 'string', 'exists:students,id'],
            'rows.*.nilai_tugas' => ['required', 'integer', 'min:0', 'max:100'],
            'rows.*.nilai_uts' => ['required', 'integer', 'min:0', 'max:100'],
            'rows.*.nilai_uas' => ['required', 'integer', 'min:0', 'max:100'],
            'rows.*.catatan_guru' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->envelope(
            $request,
            $this->service->bulkGrades($subject, $data['rows'], (bool) ($data['publish'] ?? false))
        );
    }
}
