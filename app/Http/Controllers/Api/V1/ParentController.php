<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use App\Services\FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Portal orang tua (role orang_tua + profil guardian) — semua data discope
 * ke anak yang terhubung via pivot guardian_student.
 */
class ParentController extends Controller
{
    public function children(Request $request): JsonResponse
    {
        $guardian = $this->guardianOf($request);

        if (! $guardian) {
            return $this->error($request, 'FORBIDDEN', 'Akses portal orang tua tidak tersedia.', 403);
        }

        $this->authorize('viewChildren', $guardian);

        $children = $guardian->students()
            ->with('classRoom')
            ->get()
            ->map(fn (Student $student) => [
                'id' => $student->id,
                'nisn' => $student->nisn,
                'name' => $student->name,
                'gender' => $student->gender,
                'birth_date' => $student->birth_date?->toDateString(),
                'class_room' => $student->classRoom
                    ? ['name' => $student->classRoom->name, 'grade' => $student->classRoom->grade, 'major' => $student->classRoom->major]
                    : null,
                'status' => $student->status,
            ]);

        return $this->ok($request, ['children' => $children]);
    }

    public function studentAttendance(Request $request, Student $student): JsonResponse
    {
        $guardian = $this->guardianOf($request);

        if (! $guardian) {
            return $this->error($request, 'FORBIDDEN', 'Akses portal orang tua tidak tersedia.', 403);
        }

        $this->authorize('viewStudentAttendance', [$guardian, $student]);

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $records = Attendance::query()
            ->where('student_id', $student->id)
            ->when($data['from'] ?? null, fn ($q, $from) => $q->whereDate('date', '>=', $from))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->whereDate('date', '<=', $to))
            ->orderByDesc('date')
            ->get(['date', 'status', 'time_in', 'time_out', 'source'])
            ->map(fn (Attendance $att) => [
                'date' => $att->date, // kolom date: string Y-m-d
                'status' => $att->status,
                'time_in' => $att->time_in,
                'time_out' => $att->time_out,
                'source' => $att->source,
            ]);

        return $this->ok($request, ['student_id' => $student->id, 'records' => $records]);
    }

    public function studentInvoices(Request $request, Student $student, FinanceService $finance): JsonResponse
    {
        $guardian = $this->guardianOf($request);

        if (! $guardian) {
            return $this->error($request, 'FORBIDDEN', 'Akses portal orang tua tidak tersedia.', 403);
        }

        $this->authorize('viewStudentAttendance', [$guardian, $student]);
        $this->authorize('viewStudentInvoices', $student);

        return $this->ok($request, ['student_id' => $student->id] + $finance->studentSummary($student));
    }

    public function studentGrades(Request $request, Student $student): JsonResponse
    {
        $guardian = $this->guardianOf($request);

        if (! $guardian) {
            return $this->error($request, 'FORBIDDEN', 'Akses portal orang tua tidak tersedia.', 403);
        }

        $this->authorize('viewStudentAttendance', [$guardian, $student]);

        $grades = $student->grades()->with('subject:id,code,name,kkm')
            ->where('published', true)
            ->get();

        return $this->ok($request, ['student_id' => $student->id, 'grades' => $grades]);
    }

    private function guardianOf(Request $request): ?Guardian
    {
        /** @var User $user */
        $user = $request->user();

        return Guardian::query()->where('user_id', $user?->id)->first();
    }

    private function ok(Request $request, array $data): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => null,
            'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    private function error(Request $request, string $code, string $message, int $status): JsonResponse
    {
        return response()->json([
            'data' => null,
            'meta' => null,
            'errors' => ['code' => $code, 'message' => $message],
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }
}
