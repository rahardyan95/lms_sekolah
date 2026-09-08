<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStudentRequest;
use App\Http\Requests\UpdateStudentRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Student::class);

        $students = Student::with('classRoom')
            ->when(
                $request->string('search')->toString(),
                fn ($q, $s) => $q->where(fn ($w) => $w
                    ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($s).'%'])
                    ->orWhere('nisn', $s))
            )
            ->paginate(min((int) $request->integer('per_page', 25), 100));

        return StudentResource::collection($students)->additional([
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function store(StoreStudentRequest $request): JsonResponse
    {
        $this->authorize('create', Student::class);

        $student = Student::create($request->validated());

        return $this->envelope($request, new StudentResource($student->load('classRoom')), 201);
    }

    public function show(Request $request, Student $student): JsonResponse
    {
        $this->authorize('view', $student);

        return $this->envelope($request, new StudentResource($student->load('classRoom')));
    }

    public function update(UpdateStudentRequest $request, Student $student): JsonResponse
    {
        $this->authorize('update', $student);

        $student->update($request->validated());

        return $this->envelope($request, new StudentResource($student->load('classRoom')));
    }

    public function destroy(Request $request, Student $student): JsonResponse
    {
        $this->authorize('delete', $student);

        $student->delete();

        return $this->envelope($request, ['message' => 'Data siswa dihapus.']);
    }

    protected function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => null,
            'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }
}
