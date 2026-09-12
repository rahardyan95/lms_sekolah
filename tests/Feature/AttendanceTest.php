<?php

namespace Tests\Feature;

use App\Contracts\WhatsappGatewayInterface;
use App\Enums\RoleEnum;
use App\Jobs\SendAttendanceNotification;
use App\Models\Attendance;
use App\Models\ClassRoom;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role, array $permissions = ['attendance.scan', 'attendance.reports']): User
    {
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web'])
            ->syncPermissions($role === RoleEnum::Siswa->value ? [] : $permissions);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    /** Tanggal hari berjalan menurut zona sekolah — kontrak endpoint scan. */
    private function schoolToday(): string
    {
        return now(config('school.timezone', 'Asia/Jakarta'))->format('Y-m-d');
    }

    public function test_scan_requires_operator_role(): void
    {
        $siswa = $this->makeUser(RoleEnum::Siswa->value);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $student = Student::create(['nisn' => '001', 'name' => 'Budi', 'class_room_id' => $class->id]);

        $this->actingAs($siswa)->postJson('/api/v1/attendance/scans', [
            'nisn' => $student->nisn,
            'date' => now()->format('Y-m-d'),
        ])->assertForbidden();
    }

    public function test_scan_records_once_and_rejects_duplicate(): void
    {
        $operator = $this->makeUser(RoleEnum::Operator->value);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $student = Student::create(['nisn' => '002', 'name' => 'Siti', 'class_room_id' => $class->id]);
        $payload = ['nisn' => $student->nisn, 'date' => $this->schoolToday()];

        $this->actingAs($operator)->postJson('/api/v1/attendance/scans', $payload)
            ->assertCreated()->assertJsonPath('data.status', fn ($s) => in_array($s, ['hadir', 'terlambat']));

        // Jam tersimpan memakai zona sekolah, bukan zona aplikasi (UTC).
        $this->assertSame(
            now(config('school.timezone', 'Asia/Jakarta'))->format('H:i'),
            substr((string) Attendance::latest('created_at')->first()->time_in, 0, 5)
        );

        $this->actingAs($operator)->postJson('/api/v1/attendance/scans', $payload)
            ->assertStatus(409)->assertJsonPath('errors.code', 'CONFLICT');

        // Tanggal selain hari berjalan ditolak: scan gerbang bukan alat backfill.
        $this->actingAs($operator)->postJson('/api/v1/attendance/scans', [
            'nisn' => $student->nisn,
            'date' => now(config('school.timezone', 'Asia/Jakarta'))->subDay()->format('Y-m-d'),
        ])->assertStatus(422)->assertJsonPath('errors.code', 'VALIDATION');
    }

    public function test_manual_entry_records_source_audit_and_rejects_duplicate(): void
    {
        $operator = $this->makeUser(RoleEnum::Operator->value);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $student = Student::create(['nisn' => '004', 'name' => 'Rani', 'class_room_id' => $class->id]);
        $date = now()->format('Y-m-d');

        $this->actingAs($operator)->postJson('/api/v1/attendance/manual', [
            'nisn' => $student->nisn,
            'date' => $date,
            'status' => 'sakit',
            'reason' => 'Surat dokter diterima.',
        ])->assertCreated()->assertJsonPath('data.source', 'manual');

        $this->assertDatabaseHas('attendances', [
            'student_id' => $student->id, 'source' => 'manual', 'status' => 'sakit',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'ATTENDANCE_MANUAL', 'entity' => 'attendances', 'actor_id' => $operator->id,
        ]);

        // Alpa/izin juga diterima; duplikat tanggal tetap konflik.
        $this->actingAs($operator)->postJson('/api/v1/attendance/manual', [
            'nisn' => $student->nisn, 'date' => $date, 'status' => 'izin', 'reason' => 'Duplikat.',
        ])->assertStatus(409)->assertJsonPath('errors.code', 'CONFLICT');

        // Reason wajib.
        $other = Student::create(['nisn' => '005', 'name' => 'Dedi', 'class_room_id' => $class->id]);
        $this->actingAs($operator)->postJson('/api/v1/attendance/manual', [
            'nisn' => $other->nisn, 'date' => $date, 'status' => 'alpa',
        ])->assertStatus(422);
    }

    public function test_send_attendance_notification_job_sends_wa_to_guardian(): void
    {
        $gateway = \Mockery::mock(WhatsappGatewayInterface::class);
        $gateway->shouldReceive('sendMessage')->once()
            ->with(
                \Mockery::on(fn ($to) => str_starts_with((string) $to, '0812')),
                \Mockery::on(fn ($msg) => str_contains((string) $msg, 'Siti'))
            )
            ->andReturn(['status' => 'sent']);
        $this->app->instance(WhatsappGatewayInterface::class, $gateway);

        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $student = Student::create(['nisn' => '003', 'name' => 'Siti', 'class_room_id' => $class->id]);
        $guardian = Guardian::create(['name' => 'Bpk. Siti', 'phone' => '081200000001']);
        $student->guardians()->attach($guardian->id);

        $attendance = Attendance::create([
            'student_id' => $student->id,
            'date' => now()->format('Y-m-d'),
            'time_in' => now()->format('H:i:s'),
            'status' => 'hadir',
            'source' => 'qr',
        ]);

        (new SendAttendanceNotification($attendance->id))->handle($gateway);
    }
}
