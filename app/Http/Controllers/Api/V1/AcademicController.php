<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Announcement;
use App\Models\ClassRoom;
use App\Models\Schedule;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AcademicController extends Controller
{
    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function schedules(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kelas' => ['nullable', 'string', 'max:64'],
            'day' => ['nullable', 'string', 'max:16'],
        ]);

        $kelas = $request->user()->student?->classRoom?->name;

        if ($kelas !== null) {
            $data['kelas'] = $kelas; // peserta terkunci ke kelasnya
        } elseif (! $request->user()->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator'])) {
            // Tanpa kelas dan tanpa peran staf: tidak ada jadwal yang boleh dilihat.
            return $this->envelope($request, new LengthAwarePaginator([], 0, 50));
        }

        $schedules = Schedule::with('subject:id,code,name')
            ->when($data['kelas'] ?? null, fn ($q, $k) => $q->where('kelas', $k))
            ->when($data['day'] ?? null, fn ($q, $d) => $q->where('day', $d))
            ->orderBy('day')->orderBy('time_start')
            ->paginate(50);

        return $this->envelope($request, $schedules);
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $this->authorize('manageAcademic', Schedule::class);

        $data = $request->validate([
            'day' => ['required', 'in:'.implode(',', Schedule::DAYS)],
            'time_start' => ['required', 'date_format:H:i'],
            'time_end' => ['required', 'date_format:H:i', 'after:time_start'],
            'kelas' => ['required', 'string', 'max:64'],
            'subject_id' => ['nullable', 'string', 'exists:subjects,id'],
            'subject_name' => ['required', 'string', 'max:255'],
            'teacher_name' => ['required', 'string', 'max:255'],
            'room' => ['nullable', 'string', 'max:64'],
        ]);

        if ((new Schedule)->overlaps($data['day'], $data['kelas'], $data['time_start'], $data['time_end'])) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'CONFLICT', 'message' => 'Jadwal bentrok dengan jadwal kelas yang sama.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 409);
        }

        return $this->envelope($request, Schedule::create($data), 201);
    }

    public function updateSchedule(Request $request, Schedule $schedule): JsonResponse
    {
        $this->authorize('manageAcademic', Schedule::class);

        $data = $request->validate([
            'day' => ['sometimes', 'in:'.implode(',', Schedule::DAYS)],
            'time_start' => ['sometimes', 'date_format:H:i'],
            'time_end' => ['sometimes', 'date_format:H:i', 'after:time_start'],
            'kelas' => ['sometimes', 'string', 'max:64'],
            'subject_id' => ['sometimes', 'nullable', 'string', 'exists:subjects,id'],
            'subject_name' => ['sometimes', 'string', 'max:255'],
            'teacher_name' => ['sometimes', 'string', 'max:255'],
            'room' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        $day = $data['day'] ?? $schedule->day;
        $kelas = $data['kelas'] ?? $schedule->kelas;
        $start = $data['time_start'] ?? substr((string) $schedule->time_start, 0, 5);
        $end = $data['time_end'] ?? substr((string) $schedule->time_end, 0, 5);

        if ((new Schedule)->overlaps($day, $kelas, $start, $end, $schedule->id)) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'CONFLICT', 'message' => 'Jadwal bentrok dengan jadwal kelas yang sama.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 409);
        }

        $schedule->update($data);

        return $this->envelope($request, $schedule->refresh());
    }

    public function destroySchedule(Request $request, Schedule $schedule): JsonResponse
    {
        $this->authorize('manageAcademic', Schedule::class);
        $schedule->delete();

        return $this->envelope($request, ['message' => 'Jadwal dihapus.']);
    }

    public function announcements(Request $request): JsonResponse
    {
        $role = $request->user()->getRoleNames()->first();
        $audience = match ($role) {
            'siswa' => 'Siswa', 'guru' => 'Guru', 'orang_tua' => 'Orang Tua', default => null,
        };

        $items = Announcement::query()
            ->where('published', true)
            ->when($audience, fn ($q) => $q->where(fn ($w) => $w->where('target_role', 'Semua')->orWhere('target_role', $audience)))
            ->orderByDesc('created_at')
            ->paginate(25);

        return $this->envelope($request, $items);
    }

    public function storeAnnouncement(Request $request): JsonResponse
    {
        $this->authorize('manageAcademic', Schedule::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'target_role' => ['nullable', 'in:Semua,Siswa,Guru,Orang Tua'],
            'is_important' => ['nullable', 'boolean'],
            'published' => ['nullable', 'boolean'],
        ]);

        return $this->envelope($request, Announcement::create([
            ...$data, 'created_by' => $request->user()->id,
        ]), 201);
    }

    public function academicYears(Request $request): JsonResponse
    {
        $this->authorize('viewMasterData');

        return $this->envelope($request, AcademicYear::orderByDesc('starts_at')->get());
    }

    public function storeYear(Request $request): JsonResponse
    {
        $this->authorize('manageAcademic', AcademicYear::class);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:32', 'unique:academic_years,label'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'active' => ['nullable', 'boolean'],
        ]);

        $year = DB::transaction(function () use ($data) {
            $year = AcademicYear::create([
                'label' => $data['label'],
                'starts_at' => $data['starts_at'],
                'ends_at' => $data['ends_at'],
                'active' => false,
            ]);

            if ($data['active'] ?? false) {
                $this->activate($year);
            }

            return $year;
        });

        return $this->envelope($request, $year->refresh(), 201);
    }

    public function updateYear(Request $request, AcademicYear $year): JsonResponse
    {
        $this->authorize('manageAcademic', AcademicYear::class);

        $data = $request->validate([
            'label' => ['sometimes', 'string', 'max:32', 'unique:academic_years,label,'.$year->id],
            'starts_at' => ['sometimes', 'date'],
            'ends_at' => ['sometimes', 'date', 'after:starts_at'],
        ]);

        $year->update($data);

        return $this->envelope($request, $year->refresh());
    }

    /** Aktivasi eksklusif: tepat satu tahun aktif (FRD §6). */
    public function activateYear(Request $request, AcademicYear $year): JsonResponse
    {
        $this->authorize('manageAcademic', AcademicYear::class);

        DB::transaction(fn () => $this->activate($year));

        return $this->envelope($request, $year->refresh());
    }

    public function destroyYear(Request $request, AcademicYear $year): JsonResponse
    {
        $this->authorize('manageAcademic', AcademicYear::class);

        // Riwayat tidak boleh hilang: tahun yang masih dipakai siswa tidak dihapus.
        $inUse = ClassRoom::where('academic_year_id', $year->id)
            ->whereHas('students')
            ->exists();

        if ($inUse) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'YEAR_IN_USE', 'message' => 'Tahun akademik masih dipakai oleh siswa.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 409);
        }

        $year->delete();

        return $this->envelope($request, ['message' => 'Tahun akademik dihapus.']);
    }

    private function activate(AcademicYear $year): void
    {
        AcademicYear::where('id', '!=', $year->id)->update(['active' => false]);
        $year->update(['active' => true]);
    }

    public function classRooms(Request $request): JsonResponse
    {
        $this->authorize('viewMasterData');

        return $this->envelope($request, ClassRoom::orderBy('name')->get());
    }

    public function subjectsPublic(Request $request): JsonResponse
    {
        return $this->envelope($request, Subject::orderBy('name')->paginate(50));
    }
}
