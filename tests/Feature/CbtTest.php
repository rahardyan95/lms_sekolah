<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\CbtAttempt;
use App\Models\CbtExam;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CbtTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function studentUser(): User
    {
        $user = $this->userWithRole(RoleEnum::Siswa->value);
        $classRoom = ClassRoom::firstOrCreate(['name' => 'X RPL 1'], ['grade' => 'X']);
        $student = Student::create([
            'user_id' => $user->id, 'nisn' => '7770001111', 'name' => 'Siswa CBT',
            'class_room_id' => $classRoom->id,
        ]);
        $student->refresh();

        return $user->refresh();
    }

    private function examPayload(): array
    {
        $options = ['A' => 'Opsi A', 'B' => 'Opsi B', 'C' => 'Opsi C', 'D' => 'Opsi D', 'E' => 'Opsi E'];

        return [
            'title' => 'UTS Web',
            'subject_name' => 'Pemrograman Web',
            'kelas' => 'X RPL 1',
            'duration_minutes' => 60,
            // Klien nyata (WIB) mengirim tanggal WIB — bukan tanggal UTC server,
            // yang bisa "kemarin" saat WIB 00:00–07:00 (container UTC).
            'date' => now(config('school.timezone'))->format('Y-m-d'),
            'time_start' => '00:00',
            'time_end' => '23:59',
            'status' => 'published',
            'questions' => [
                ['question' => 'Q1', 'options' => $options, 'correct_answer' => 'B'],
                ['question' => 'Q2', 'options' => $options, 'correct_answer' => 'C'],
            ],
        ];
    }

    public function test_guru_can_create_exam_but_siswa_cannot(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);

        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())
            ->assertCreated()
            ->assertJsonPath('data.title', 'UTS Web');

        $siswa = $this->studentUser();

        $this->actingAs($siswa)->postJson('/api/v1/cbt/exams', $this->examPayload())
            ->assertForbidden();
    }

    public function test_auto_submit_command_grades_expired_attempts(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $exam = $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())
            ->assertCreated()->json('data');

        $siswa = $this->studentUser();
        $expired = CbtAttempt::create([
            'exam_id' => $exam['id'],
            'user_id' => $siswa->id,
            'started_at' => now()->subHours(2),
            'deadline_at' => now()->subHour(),
            'submitted_at' => null,
        ]);

        $this->artisan('cbt:auto-submit')->assertSuccessful();

        $expired->refresh();
        $this->assertNotNull($expired->submitted_at);
        $this->assertNotNull($expired->score);

        // Idempotent: menjalankan ulang tidak mengubah hasil.
        $score = $expired->score;
        $this->artisan('cbt:auto-submit')->assertSuccessful();
        $this->assertSame($score, $expired->refresh()->score);
    }

    public function test_publish_requires_at_least_one_question(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $exam = CbtExam::create([
            'title' => 'Kosong', 'subject_name' => 'X', 'kelas' => 'X RPL 1',
            'duration_minutes' => 30, 'date' => now()->toDateString(),
            'time_start' => '08:00', 'time_end' => '09:00',
            'status' => CbtExam::STATUS_DRAFT, 'created_by' => $guru->id,
        ]);

        $this->actingAs($guru)
            ->patchJson("/api/v1/cbt/exams/{$exam->id}/status", ['status' => 'published'])
            ->assertForbidden();

        $this->assertSame(CbtExam::STATUS_DRAFT, $exam->refresh()->status);

        // Dengan soal → publikasi diizinkan.
        $exam->questions()->create([
            'number' => 1, 'question' => 'Q1',
            'options' => ['A' => 'a', 'B' => 'b', 'C' => 'c', 'D' => 'd', 'E' => 'e'],
            'correct_answer' => 'A',
        ]);

        $this->actingAs($guru)
            ->patchJson("/api/v1/cbt/exams/{$exam->id}/status", ['status' => 'published'])
            ->assertOk();

        $this->assertSame(CbtExam::STATUS_PUBLISHED, $exam->refresh()->status);
    }

    public function test_exam_index_never_exposes_answer_keys(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())->assertCreated();

        $siswa = $this->studentUser();
        $res = $this->actingAs($siswa)->getJson('/api/v1/cbt/exams')->assertOk();

        $body = $res->json('data');
        $this->assertNotEmpty($body);
        $this->assertArrayNotHasKey('correct_answer', $body[0]['questions'][0]);
        $this->assertArrayNotHasKey('explanation', $body[0]['questions'][0]);
        $this->assertStringNotContainsString('correct_answer', $res->getContent());
    }

    public function test_full_attempt_flow_with_server_grading(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())->assertCreated();
        $exam = CbtExam::first();

        $siswa = $this->studentUser();

        // Start → deadline dari jam server.
        $start = $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")->assertCreated();
        $attemptId = $start->json('data.id');
        $this->assertNotEmpty($start->json('data.deadline_at'));

        $attempt = CbtAttempt::findOrFail($attemptId);
        $this->assertEquals($siswa->id, $attempt->user_id);
        $this->assertTrue($attempt->deadline_at->greaterThan($attempt->started_at));

        // Start ulang mengembalikan attempt aktif yang sama (idempotent).
        $again = $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")->assertCreated();
        $this->assertSame($attemptId, $again->json('data.id'));

        $questions = $exam->questions()->orderBy('number')->get();

        // Autosave: 1 benar (B), 1 salah (A, kunci C).
        $this->actingAs($siswa)->patchJson("/api/v1/cbt/attempts/{$attemptId}/answers", [
            'question_id' => $questions[0]->id, 'answer' => 'B', 'hesitant' => true,
        ])->assertOk();
        $this->actingAs($siswa)->patchJson("/api/v1/cbt/attempts/{$attemptId}/answers", [
            'question_id' => $questions[1]->id, 'answer' => 'A',
        ])->assertOk();

        // Submit → skor 50 dari server, kunci + pembahasan terbuka pasca-submit.
        $submit = $this->actingAs($siswa)->postJson("/api/v1/cbt/attempts/{$attemptId}/submit")
            ->assertOk()
            ->assertJsonPath('data.score', 50)
            ->assertJsonPath('data.correct', 1)
            ->assertJsonPath('data.total', 2);

        $this->assertSame('B', $submit->json('data.attempt.questions.0.correct_answer'));

        // Submit ulang idempotent — skor sama, tidak duplikat.
        $this->actingAs($siswa)->postJson("/api/v1/cbt/attempts/{$attemptId}/submit")
            ->assertOk()
            ->assertJsonPath('data.score', 50);

        // Jawaban terkunci pasca-submit.
        $this->actingAs($siswa)->patchJson("/api/v1/cbt/attempts/{$attemptId}/answers", [
            'question_id' => $questions[0]->id, 'answer' => 'A',
        ])->assertStatus(422);
    }

    public function test_cannot_start_outside_window_or_draft(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);

        // Draft tidak bocor ke siswa (403), bukan 422.
        $draft = $this->examPayload();
        $draft['status'] = 'draft';
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $draft)->assertCreated();
        $draftExam = CbtExam::first();

        $siswa = $this->studentUser();

        $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$draftExam->id}/attempts")->assertForbidden();

        // Published tapi jendela waktu tutup → 422 dari jam server.
        $closed = $this->examPayload();
        $closed['title'] = 'UTS Tutup';
        $closed['time_start'] = '00:00';
        $closed['time_end'] = '00:01';
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $closed)->assertCreated();
        $closedExam = CbtExam::where('title', 'UTS Tutup')->first();

        if ($closedExam->isOpenNow()) {
            $this->markTestSkipped('Jendela 00:00-00:01 masih terbuka saat test jalan.');
        }

        $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$closedExam->id}/attempts")->assertStatus(422);
    }

    public function test_attempt_isolation_between_students(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())->assertCreated();
        $exam = CbtExam::first();

        $siswaA = $this->studentUser();
        $start = $this->actingAs($siswaA)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")->assertCreated();
        $attemptId = $start->json('data.id');

        Role::firstOrCreate(['name' => RoleEnum::Siswa->value, 'guard_name' => 'web']);
        $siswaB = User::factory()->create(['status' => 'active']);
        $siswaB->assignRole(RoleEnum::Siswa->value);

        $this->actingAs($siswaB)->getJson("/api/v1/cbt/attempts/{$attemptId}")->assertForbidden();
        $this->actingAs($siswaB)->postJson("/api/v1/cbt/attempts/{$attemptId}/submit")->assertForbidden();
    }

    public function test_student_cannot_see_or_take_another_class_exam(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())->assertCreated();
        $exam = CbtExam::first();                      // kelas: 'X RPL 1'

        $siswa = $this->studentUser();
        Student::where('user_id', $siswa->id)->update([
            'class_room_id' => ClassRoom::create(['name' => 'XI TKJ 1', 'grade' => 'XI'])->id,
        ]);

        $this->actingAs($siswa->refresh())->getJson('/api/v1/cbt/exams')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")->assertForbidden();
    }

    public function test_expired_attempt_is_not_restarted_with_a_fresh_deadline(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/cbt/exams', $this->examPayload())->assertCreated();
        $exam = CbtExam::first();
        $siswa = $this->studentUser();

        $first = $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")
            ->assertCreated()->json('data.id');

        CbtAttempt::whereKey($first)->update(['deadline_at' => now()->subMinute()]);

        $again = $this->actingAs($siswa)->postJson("/api/v1/cbt/exams/{$exam->id}/attempts")
            ->assertCreated()->json('data.id');

        $this->assertSame($first, $again);
        $this->assertSame(1, CbtAttempt::where('exam_id', $exam->id)->where('user_id', $siswa->id)->count());
    }

    public function test_guest_cannot_access_cbt(): void
    {
        $this->getJson('/api/v1/cbt/exams')->assertUnauthorized();
    }
}
