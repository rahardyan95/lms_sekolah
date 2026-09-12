<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Attendance;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AttendanceExportTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function attendance(string $nisn, string $name, string $date): Attendance
    {
        $student = Student::create(['nisn' => $nisn, 'name' => $name, 'status' => 'active']);

        return Attendance::create([
            'student_id' => $student->id,
            'date' => $date,
            'time_in' => '07:05',
            'status' => 'hadir',
            'source' => 'qr',
        ]);
    }

    public function test_export_streams_csv_with_header_and_rows(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);
        $this->attendance('9000000001', 'Ahmad Fauzi', '2026-09-01');
        $this->attendance('9000000002', 'Siti Aminah', '2026-09-02');

        $res = $this->actingAs($operator)->get('/api/v1/attendance/reports/export?from=2026-09-01&to=2026-09-30');

        $res->assertOk();
        $this->assertStringContainsString('text/csv', (string) $res->headers->get('content-type'));

        $csv = $res->streamedContent();
        $this->assertStringContainsString('Tanggal,NISN,Nama', $csv);
        $this->assertStringContainsString('Ahmad Fauzi', $csv);
        $this->assertStringContainsString('9000000002', $csv);
    }

    public function test_export_includes_attachment_filename_with_range(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);

        $res = $this->actingAs($admin)->get('/api/v1/attendance/reports/export?from=2026-09-01&to=2026-09-07');

        $res->assertOk();
        $this->assertStringContainsString('presensi-2026-09-01_2026-09-07.csv', (string) $res->headers->get('content-disposition'));
    }

    public function test_export_escapes_csv_formula_injection(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);
        // Nama siswa dimulai '=' — vektor CSV injection bila tidak di-escape.
        $this->attendance('9000000003', '=cmd|calc', '2026-09-03');

        $csv = $this->actingAs($operator)
            ->get('/api/v1/attendance/reports/export?from=2026-09-01&to=2026-09-30')
            ->streamedContent();

        $this->assertStringContainsString("'=cmd|calc", $csv);
        $this->assertStringNotContainsString(',=cmd|calc', $csv);
    }

    public function test_export_rejects_range_over_limit(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);

        $this->actingAs($operator)
            ->getJson('/api/v1/attendance/reports/export?from=2026-01-01&to=2026-12-31')
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'RANGE_TOO_WIDE');
    }

    public function test_portal_role_cannot_export(): void
    {
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);

        $this->actingAs($siswa)
            ->getJson('/api/v1/attendance/reports/export?from=2026-09-01&to=2026-09-07')
            ->assertForbidden();
    }
}
