<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AttendanceReportPdfTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_operator_downloads_pdf_report_with_attachment_name(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $student = Student::create(['nisn' => '9900000001', 'name' => 'Laporan Uji', 'class_room_id' => $class->id]);

        Attendance::create([
            'student_id' => $student->id, 'date' => '2026-09-02', 'time_in' => '07:05',
            'status' => 'hadir', 'source' => 'qr',
        ]);
        Attendance::create([
            'student_id' => $student->id, 'date' => '2026-09-03', 'time_in' => '07:30',
            'status' => 'terlambat', 'source' => 'qr',
        ]);

        $res = $this->actingAs($operator)
            ->get('/api/v1/attendance/reports/pdf?from=2026-09-01&to=2026-09-30&class_room_id='.$class->id);

        $res->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $res->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF-', (string) $res->getContent());
        $this->assertStringContainsString('presensi-2026-09-01_2026-09-30.pdf', (string) $res->headers->get('content-disposition'));
    }

    public function test_portal_role_cannot_download_pdf_report(): void
    {
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);

        $this->actingAs($siswa)
            ->get('/api/v1/attendance/reports/pdf?from=2026-09-01&to=2026-09-02')
            ->assertForbidden();
    }

    public function test_pdf_report_enforces_max_range(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);

        $this->actingAs($operator)
            ->get('/api/v1/attendance/reports/pdf?from=2026-01-01&to=2026-12-31')
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'RANGE_TOO_WIDE');
    }
}
