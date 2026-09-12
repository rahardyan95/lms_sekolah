<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\ClassRoom;
use App\Models\KtsTemplate;
use App\Models\KtsToken;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class KtsCardTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function student(string $nisn = '7700000001', ?User $user = null): Student
    {
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);

        return Student::create([
            'user_id' => $user?->id,
            'nisn' => $nisn,
            'nik' => '3175012345670001',
            'name' => 'Siswa KTS',
            'class_room_id' => $class->id,
            'status' => 'active',
        ]);
    }

    public function test_issue_then_verify_and_revoke_invalidates(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = $this->student();

        $issued = $this->actingAs($admin)
            ->postJson("/api/v1/kts/students/{$student->id}/issue")
            ->assertCreated()->json('data');

        $this->postJson('/api/v1/kts/verify', [
            'payload' => $issued['payload'], 'signature' => $issued['signature'],
        ])->assertOk()->assertJsonPath('data.valid', true);

        $token = KtsToken::where('student_id', $student->id)->firstOrFail();
        $this->actingAs($admin)->postJson("/api/v1/kts/tokens/{$token->id}/revoke")->assertOk();

        $this->postJson('/api/v1/kts/verify', [
            'payload' => $issued['payload'], 'signature' => $issued['signature'],
        ])->assertStatus(422)->assertJsonPath('data.valid', false);
    }

    public function test_card_pdf_download_and_qr_svg_carry_a_signed_token(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $student = $this->student();

        $pdf = $this->actingAs($admin)->get("/api/v1/kts/students/{$student->id}/card")->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('content-type'));
        $body = (string) $pdf->getContent();
        $this->assertStringStartsWith('%PDF-', $body);

        $qr = $this->actingAs($admin)->get("/api/v1/kts/students/{$student->id}/qr.svg")->assertOk();
        $this->assertStringContainsString('image/svg+xml', (string) $qr->headers->get('content-type'));
        // QR tidak memuat NISN mentah — hanya token bertanda tangan (base64).
        $this->assertStringNotContainsString($student->nisn, (string) $qr->getContent());

        // Payload QR = token bertanda tangan (terverifikasi server), bukan NISN mentah.
        $token = KtsToken::where('student_id', $student->id)->firstOrFail();
        $payload = base64_encode(json_encode([
            'nisn' => $student->nisn,
            'jti' => $token->jti,
            'exp' => $token->expires_at->timestamp,
        ]));
        $signature = hash_hmac('sha256', $payload, (string) config('app.key'));

        $this->postJson('/api/v1/kts/verify', ['payload' => $payload, 'signature' => $signature])
            ->assertOk()->assertJsonPath('data.valid', true);
    }

    public function test_siswa_can_only_fetch_their_own_card(): void
    {
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $own = $this->student('7700000010', $siswa);
        $other = $this->student('7700000011');

        $this->actingAs($siswa)->get("/api/v1/kts/students/{$own->id}/card")->assertOk();
        $this->actingAs($siswa)->get("/api/v1/kts/students/{$other->id}/card")->assertForbidden();
    }

    public function test_template_save_creates_new_version_and_keeps_history(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);

        $first = $this->actingAs($admin)->getJson('/api/v1/kts/templates/active')->assertOk()->json('data');
        $this->assertSame(1, $first['version']);

        $second = $this->actingAs($admin)->putJson('/api/v1/kts/templates', [
            'colors' => ['header' => '#111827'],
            'watermark' => 'SMKN 1',
            'visibility' => ['nik' => false],
        ])->assertOk()->json('data');

        $this->assertSame(2, $second['version']);
        $this->assertSame('#111827', $second['colors']['header']);
        $this->assertFalse($second['visibility']['nik']);

        // Baris lama tetap ada dan tetap tidak aktif (riwayat immutable).
        $this->assertSame(2, KtsTemplate::count());
        $this->assertSame(1, KtsTemplate::where('active', true)->count());
    }
}
