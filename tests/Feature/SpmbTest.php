<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\SpmbApplication;
use App\Models\SpmbWave;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SpmbTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function openWave(array $over = []): SpmbWave
    {
        return SpmbWave::create(array_merge([
            'name' => 'Gelombang 1',
            'start_date' => now()->subDay()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
            'quota' => 150, 'fee' => 200000, 'active' => true,
        ], $over));
    }

    private function applicant(string $nisn = '8810000001'): array
    {
        return [
            'name' => 'Calon A', 'nisn' => $nisn, 'gender' => 'L',
            'birth_place' => 'Jakarta', 'birth_date' => '2009-05-12',
            'parent_name' => 'Ortu A', 'parent_phone' => '081200000001',
            'previous_school' => 'SMPN 1', 'average_score' => 89.4,
            'chosen_major' => 'Rekayasa Perangkat Lunak',
        ];
    }

    public function test_public_submit_and_status_check(): void
    {
        $wave = $this->openWave();

        $res = $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft');

        $regno = $res->json('data.registration_number');
        $this->assertNotEmpty($regno);

        $this->postJson('/api/v1/spmb/status', [
            'registration_number' => $regno, 'birth_date' => '2009-05-12',
        ])->assertOk()->assertJsonPath('data.status', 'draft');

        // NISN ganda ditolak.
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant())
            ->assertStatus(422);
    }

    public function test_proof_pdf_requires_matching_credentials(): void
    {
        $wave = $this->openWave();
        $res = $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant())
            ->assertCreated();
        $applicationId = $res->json('data.id');
        $regno = $res->json('data.registration_number');

        // Kredensial salah → 403 tanpa membocorkan dokumen.
        $this->get("/api/v1/spmb/applications/{$applicationId}/proof?registration_number={$regno}&birth_date=2000-01-01")
            ->assertForbidden();

        $pdf = $this->get("/api/v1/spmb/applications/{$applicationId}/proof?registration_number={$regno}&birth_date=2009-05-12")
            ->assertOk();

        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF-', (string) $pdf->getContent());
    }

    public function test_closed_wave_and_full_quota_rejected(): void
    {
        $closed = $this->openWave(['active' => false]);
        $this->postJson("/api/v1/spmb/waves/{$closed->id}/applications", $this->applicant())
            ->assertStatus(422);

        $full = $this->openWave(['quota' => 1]);
        $this->postJson("/api/v1/spmb/waves/{$full->id}/applications", $this->applicant('8810000011'))
            ->assertCreated();
        $app = SpmbApplication::where('nisn', '8810000011')->first();
        $app->update(['status' => 'verified']);

        $this->postJson("/api/v1/spmb/waves/{$full->id}/applications", $this->applicant('8810000012'))
            ->assertStatus(422);
    }

    public function test_verify_decide_convert_flow_idempotent(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $wave = $this->openWave();
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000021'))
            ->assertCreated();
        $app = SpmbApplication::where('nisn', '8810000021')->first();

        // Operator boleh review tapi tidak boleh memutuskan.
        $operator = $this->userWithRole(RoleEnum::Operator->value);
        $this->actingAs($operator)->postJson("/api/v1/spmb/applications/{$app->id}/decide", [
            'status' => 'accepted',
        ])->assertForbidden();

        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/verify")
            ->assertOk()->assertJsonPath('data.status', 'verified');

        // Tolak tanpa alasan → 422.
        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/decide", [
            'status' => 'rejected',
        ])->assertStatus(422);

        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/decide", [
            'status' => 'accepted', 'notes' => 'Lolos.',
        ])->assertOk()->assertJsonPath('data.status', 'accepted');

        $convert = $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/convert")
            ->assertCreated();
        $studentId = $convert->json('data.id');

        $again = $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/convert")
            ->assertCreated();
        $this->assertSame($studentId, $again->json('data.id'));
        $this->assertSame(1, Student::where('nisn', '8810000021')->count());
    }

    public function test_verify_rejects_when_wave_quota_already_filled(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $wave = $this->openWave(['quota' => 1]);

        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000051'))
            ->assertCreated();
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000052'))
            ->assertCreated();

        $first = SpmbApplication::where('nisn', '8810000051')->first();
        $second = SpmbApplication::where('nisn', '8810000052')->first();

        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$first->id}/verify")
            ->assertOk()->assertJsonPath('data.status', 'verified');

        // Kuota terisi 1/1 → verifikasi berikutnya ditolak, bukan lolos.
        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$second->id}/verify")
            ->assertStatus(422);

        $this->assertSame('draft', $second->refresh()->status);
    }

    public function test_convert_links_existing_student_row_to_the_new_user(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $wave = $this->openWave();
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000061'))
            ->assertCreated();
        $app = SpmbApplication::where('nisn', '8810000061')->first();

        // Baris siswa sudah ada (dibuat admin) tanpa akun: konversi harus menautkannya.
        Student::create(['nisn' => '8810000061', 'name' => 'Sudah Ada']);

        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/verify")->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/decide", [
            'status' => 'accepted', 'notes' => 'Lolos.',
        ])->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/spmb/applications/{$app->id}/convert")->assertCreated();

        $this->assertSame(1, Student::where('nisn', '8810000061')->count());

        $student = Student::where('nisn', '8810000061')->first();
        $this->assertNotNull($student->user_id);
        $this->assertTrue($student->user->hasRole(RoleEnum::Siswa->value));
    }

    public function test_file_upload_allowlist_and_size(): void
    {
        Storage::fake('local');
        $wave = $this->openWave();
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000031'))
            ->assertCreated();
        $app = SpmbApplication::where('nisn', '8810000031')->first();

        $this->postJson("/api/v1/spmb/applications/{$app->id}/files", [
            'registration_number' => $app->registration_number,
            'birth_date' => '2009-05-12',
            'kind' => 'rapor',
            'file' => UploadedFile::fake()->create('nilai.exe', 100, 'application/x-msdownload'),
        ])->assertStatus(422);

        // Kredensial pendaftaran tidak cocok → ditolak (sebelumnya siapa pun bisa).
        $this->postJson("/api/v1/spmb/applications/{$app->id}/files", [
            'registration_number' => 'SPMB-0000-0000',
            'birth_date' => '2009-05-12',
            'kind' => 'rapor',
            'file' => UploadedFile::fake()->create('rapor.pdf', 500, 'application/pdf'),
        ])->assertStatus(403);

        $this->postJson("/api/v1/spmb/applications/{$app->id}/files", [
            'registration_number' => $app->registration_number,
            'birth_date' => '2009-05-12',
            'kind' => 'rapor',
            'file' => UploadedFile::fake()->create('rapor.pdf', 500, 'application/pdf'),
        ])->assertCreated();

        $this->assertSame(1, $app->files()->count());
    }
}
