<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Assignment;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\Material;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class LmsTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function studentUser(string $nisn = '7700000001'): User
    {
        $user = $this->userWithRole(RoleEnum::Siswa->value);
        Student::create(['user_id' => $user->id, 'nisn' => $nisn, 'name' => 'Siswa LMS']);

        return $user->refresh();
    }

    public function test_teacher_manages_subjects_materials_assignments(): void
    {
        Storage::fake('local');
        $guru = $this->userWithRole(RoleEnum::Guru->value);

        $subject = $this->actingAs($guru)->postJson('/api/v1/lms/subjects', [
            'code' => 'RPL-301', 'name' => 'Pemrograman Web', 'kkm' => 75,
        ])->assertCreated()->json('data');

        $this->actingAs($guru)->postJson('/api/v1/lms/materials', [
            'subject_id' => $subject['id'], 'title' => 'Modul 1',
            'file_type' => 'PDF',
            'file' => UploadedFile::fake()->create('modul.pdf', 500, 'application/pdf'),
        ])->assertCreated();

        $this->actingAs($guru)->postJson('/api/v1/lms/assignments', [
            'subject_id' => $subject['id'], 'title' => 'Tugas 1',
            'deadline' => now()->addWeek()->toIso8601String(),
        ])->assertCreated();

        // Siswa tidak boleh membuat materi.
        $siswa = $this->studentUser();
        $this->actingAs($siswa)->postJson('/api/v1/lms/materials', [
            'title' => 'X', 'file_type' => 'PDF',
        ])->assertForbidden();
    }

    public function test_student_submit_on_time_late_and_closed_policy(): void
    {
        Storage::fake('local');
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $subject = Subject::create(['code' => 'MAT-101', 'name' => 'Matematika']);
        $open = Assignment::create([
            'subject_id' => $subject->id, 'title' => 'T1',
            'deadline' => now()->addDay(), 'created_by' => $guru->id,
        ]);
        $late = Assignment::create([
            'subject_id' => $subject->id, 'title' => 'T0',
            'deadline' => now()->subMinute(), 'created_by' => $guru->id,
        ]);
        $closed = Assignment::create([
            'subject_id' => $subject->id, 'title' => 'TC',
            'deadline' => now()->addDay(), 'closed_at' => now(), 'created_by' => $guru->id,
        ]);

        $siswa = $this->studentUser();

        $this->actingAs($siswa)->postJson("/api/v1/lms/assignments/{$open->id}/submissions", [
            'file' => UploadedFile::fake()->create('tugas.pdf', 300, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('data.status', 'submitted');

        // Kirim ulang menimpa (bukan duplikat).
        $this->actingAs($siswa)->postJson("/api/v1/lms/assignments/{$open->id}/submissions", [
            'file' => UploadedFile::fake()->create('tugas-v2.pdf', 300, 'application/pdf'),
        ])->assertCreated();
        $this->assertSame(1, $open->submissions()->count());

        // Lewat tenggat tetapi belum ditutup → diterima sebagai 'late' (FRD §9).
        $this->actingAs($siswa)->postJson("/api/v1/lms/assignments/{$late->id}/submissions", [
            'file' => UploadedFile::fake()->create('telat.pdf', 300, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('data.status', 'late');

        // Ditutup eksplisit → ditolak.
        $this->actingAs($siswa)->postJson("/api/v1/lms/assignments/{$closed->id}/submissions", [
            'file' => UploadedFile::fake()->create('tutup.pdf', 300, 'application/pdf'),
        ])->assertStatus(422);
    }

    public function test_student_summary_reports_attendance_and_average_grade(): void
    {
        $siswa = $this->studentUser();
        $student = Student::where('user_id', $siswa->id)->firstOrFail();

        Attendance::create([
            'student_id' => $student->id, 'date' => now()->toDateString(),
            'status' => 'hadir', 'source' => 'qr',
        ]);

        $subject = Subject::create(['code' => 'FIS-101', 'name' => 'Fisika']);
        $otherSubject = Subject::create(['code' => 'KIM-101', 'name' => 'Kimia']);
        Grade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id,
            'nilai_akhir' => 80, 'published' => true,
        ]);
        Grade::create([
            'student_id' => $student->id, 'subject_id' => $otherSubject->id,
            'nilai_akhir' => 100, 'published' => false,
        ]);

        $data = $this->actingAs($siswa)->getJson('/api/v1/lms/summary/mine')->assertOk()->json('data');

        $this->assertSame($student->nisn, $data['nisn']);
        $this->assertSame($student->name, $data['name']);
        $this->assertArrayHasKey('class_name', $data);
        $this->assertArrayHasKey('major', $data);
        $this->assertSame(80.0, (float) $data['average_grade']);
        $this->assertGreaterThan(0, (float) $data['attendance_percentage']);
        $this->assertLessThanOrEqual(100, (float) $data['attendance_percentage']);
    }

    public function test_bulk_grades_compute_predikat_and_publish_gate(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $subject = Subject::create(['code' => 'ING-102', 'name' => 'B. Inggris']);
        $s1 = Student::create(['nisn' => '7700000011', 'name' => 'A']);
        $s2 = Student::create(['nisn' => '7700000012', 'name' => 'B']);

        $this->actingAs($guru)->postJson("/api/v1/lms/subjects/{$subject->id}/grades/bulk", [
            'publish' => false,
            'rows' => [
                ['student_id' => $s1->id, 'nilai_tugas' => 92, 'nilai_uts' => 88, 'nilai_uas' => 90],
                ['student_id' => $s2->id, 'nilai_tugas' => 70, 'nilai_uts' => 70, 'nilai_uas' => 70],
            ],
        ])->assertOk()->assertJsonPath('data.created', 2);

        $this->assertSame('A', Grade::where('student_id', $s1->id)->first()->predikat);
        $this->assertSame('C', Grade::where('student_id', $s2->id)->first()->predikat);

        // Belum publish → siswa tidak melihat.
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        Student::where('nisn', '7700000011')->update(['user_id' => $siswa->id]);
        $this->actingAs($siswa)->getJson('/api/v1/lms/grades/mine')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($guru)->postJson("/api/v1/lms/subjects/{$subject->id}/grades/bulk", [
            'publish' => true,
            'rows' => [
                ['student_id' => $s1->id, 'nilai_tugas' => 92, 'nilai_uts' => 88, 'nilai_uas' => 90],
            ],
        ])->assertOk()->assertJsonPath('data.updated', 1);

        $this->actingAs($siswa)->getJson('/api/v1/lms/grades/mine')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_submission_and_grade_isolation(): void
    {
        Storage::fake('local');
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $subject = Subject::create(['code' => 'FIS-101', 'name' => 'Fisika']);
        $assignment = Assignment::create([
            'subject_id' => $subject->id, 'title' => 'T',
            'deadline' => now()->addDay(), 'created_by' => $guru->id,
        ]);

        $siswaA = $this->studentUser('7700000021');
        $siswaB = $this->studentUser('7700000022');

        $this->actingAs($siswaA)->postJson("/api/v1/lms/assignments/{$assignment->id}/submissions", [
            'file' => UploadedFile::fake()->create('a.pdf', 100, 'application/pdf'),
        ])->assertCreated();

        // B tidak bisa menilai (403), guru bisa.
        $submission = $assignment->submissions()->first();
        $this->actingAs($siswaB)->patchJson("/api/v1/lms/submissions/{$submission->id}/grade", [
            'score' => 100,
        ])->assertForbidden();
        $this->actingAs($guru)->patchJson("/api/v1/lms/submissions/{$submission->id}/grade", [
            'score' => 85, 'feedback' => 'Bagus',
        ])->assertOk()->assertJsonPath('data.status', 'graded');
    }

    public function test_parent_cannot_list_private_materials(): void
    {
        Storage::fake('local');
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $subject = Subject::create(['code' => 'KIM-101', 'name' => 'Kimia']);
        Material::create([
            'subject_id' => $subject->id, 'title' => 'Modul Rahasia',
            'file_type' => 'PDF', 'kelas' => 'XII IPA 1', 'path' => 'lms/materials/a.pdf',
        ]);

        $parent = $this->userWithRole(RoleEnum::OrangTua->value);

        $this->actingAs($parent)->getJson('/api/v1/lms/materials')->assertForbidden();
        $this->actingAs($guru)->getJson('/api/v1/lms/materials')
            ->assertOk()->assertJsonCount(1, 'data.data');
    }
}
