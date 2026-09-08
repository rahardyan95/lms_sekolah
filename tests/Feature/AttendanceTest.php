<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\ClassRoom;
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
        $payload = ['nisn' => $student->nisn, 'date' => now()->format('Y-m-d')];

        $this->actingAs($operator)->postJson('/api/v1/attendance/scans', $payload)
            ->assertCreated()->assertJsonPath('data.status', fn ($s) => in_array($s, ['hadir', 'terlambat']));

        $this->actingAs($operator)->postJson('/api/v1/attendance/scans', $payload)
            ->assertStatus(409)->assertJsonPath('errors.code', 'CONFLICT');
    }
}
