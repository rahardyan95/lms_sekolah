<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\AuditLog;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class KtsPhotoTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_petugas_uploads_photo_and_card_pdf_embeds_it(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9800000001', 'name' => 'Berfoto', 'status' => 'active']);

        $res = $this->actingAs($admin)->post("/api/v1/kts/students/{$student->id}/photo", [
            'photo' => UploadedFile::fake()->image('foto.png', 120, 150),
        ]);

        $res->assertOk()->assertJsonPath('data.photo_path', fn ($p) => is_string($p) && $p !== '');

        $path = $res->json('data.photo_path');
        Storage::disk('local')->assertExists($path);
        $this->assertSame($path, $student->refresh()->photo_path);
        $this->assertNotNull($student->photo_data_uri);
        $this->assertStringStartsWith('data:image/png;base64,', (string) $student->photo_data_uri);

        // Kartu PDF tetap dapat dirender dengan foto tertanam.
        $card = $this->actingAs($admin)->get("/api/v1/kts/students/{$student->id}/card");
        $card->assertOk();
        $this->assertStringStartsWith('%PDF-', (string) $card->getContent());

        $this->assertDatabaseHas('audit_logs', ['action' => 'KTS_PHOTO_UPLOADED', 'entity_id' => $student->id]);
        $this->assertSame(1, AuditLog::where('action', 'KTS_PHOTO_UPLOADED')->count());
    }

    public function test_upload_replaces_previous_file(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9800000002', 'name' => 'Ganti Foto', 'status' => 'active']);

        $first = $this->actingAs($admin)->post("/api/v1/kts/students/{$student->id}/photo", [
            'photo' => UploadedFile::fake()->image('a.png', 100, 120),
        ])->json('data.photo_path');

        $second = $this->actingAs($admin)->post("/api/v1/kts/students/{$student->id}/photo", [
            'photo' => UploadedFile::fake()->image('b.png', 100, 120),
        ])->json('data.photo_path');

        Storage::disk('local')->assertExists($second);
        Storage::disk('local')->assertMissing($first);
        $this->assertTrue($student->refresh()->photo_data_uri !== null);
    }

    public function test_upload_rejects_disallowed_mime(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9800000003', 'name' => 'Mime', 'status' => 'active']);

        $this->actingAs($admin)->post("/api/v1/kts/students/{$student->id}/photo", [
            'photo' => UploadedFile::fake()->create('dokumen.pdf', 100, 'application/pdf'),
        ])->assertStatus(422)->assertJsonPath('errors.code', 'VALIDATION');

        $this->assertNull($student->refresh()->photo_path);
    }

    public function test_siswa_cannot_upload_photo_for_another_student(): void
    {
        Storage::fake('local');
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $own = Student::create(['user_id' => $siswa->id, 'nisn' => '9800000004', 'name' => 'Sendiri', 'status' => 'active']);
        $other = Student::create(['nisn' => '9800000005', 'name' => 'Orang Lain', 'status' => 'active']);

        foreach ([$own, $other] as $target) {
            $this->actingAs($siswa)->post("/api/v1/kts/students/{$target->id}/photo", [
                'photo' => UploadedFile::fake()->create('x.jpg', 50, 'image/jpeg'),
            ])->assertForbidden();
        }

        $this->assertNull($other->refresh()->photo_path);
    }

    public function test_photo_download_requires_valid_signature(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9800000006', 'name' => 'Signed', 'status' => 'active']);

        $this->actingAs($admin)->post("/api/v1/kts/students/{$student->id}/photo", [
            'photo' => UploadedFile::fake()->image('f.png', 90, 110),
        ])->assertOk();

        // Tanpa tanda tangan → ditolak middleware `signed`.
        $this->actingAs($admin)->get("/api/v1/kts/students/{$student->id}/photo")->assertForbidden();

        // Dengan URL bertanda tangan → berkas terkirim.
        $signed = $student->refresh()->photo_url;
        $this->assertNotNull($signed);

        $path = parse_url((string) $signed, PHP_URL_PATH).'?'.parse_url((string) $signed, PHP_URL_QUERY);
        $this->actingAs($admin)->get($path)->assertOk();
    }

    public function test_photo_missing_returns_not_found_with_signed_url(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9800000007', 'name' => 'Tanpa Foto', 'status' => 'active']);

        $this->actingAs($admin)
            ->get("/api/v1/kts/students/{$student->id}/photo")
            ->assertForbidden(); // tanpa signature tetap 403 (route signed)
    }
}
