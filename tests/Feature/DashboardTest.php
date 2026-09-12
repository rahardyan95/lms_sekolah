<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Attendance;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function student(string $nisn, string $status = 'active'): Student
    {
        return Student::create(['nisn' => $nisn, 'name' => 'Siswa '.$nisn, 'status' => $status]);
    }

    public function test_staff_gets_real_summary_numbers(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);

        $this->student('1111111111');
        $this->student('2222222222');
        $this->student('3333333333', 'inactive');

        $active = Student::where('nisn', '1111111111')->firstOrFail();
        Attendance::create([
            'student_id' => $active->id,
            'date' => now(config('school.timezone'))->format('Y-m-d'),
            'status' => 'hadir',
            'source' => 'qr',
        ]);

        $this->actingAs($operator)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_students', 2)
            ->assertJsonPath('data.attendance_today', 1)
            ->assertJsonPath('data.attendance_rate', 50)
            ->assertJsonCount(30, 'data.trend_30d');
    }

    public function test_summary_ignores_other_days(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $student = $this->student('4444444444');

        Attendance::create([
            'student_id' => $student->id,
            'date' => now(config('school.timezone'))->subDay()->format('Y-m-d'),
            'status' => 'hadir',
            'source' => 'qr',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.attendance_today', 0);
    }

    public function test_summary_trend_counts_today_and_per_kelas(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $student = $this->student('5555555555');

        $today = now(config('school.timezone'))->format('Y-m-d');

        Attendance::create([
            'student_id' => $student->id, 'date' => $today,
            'status' => 'hadir', 'source' => 'qr',
        ]);

        $res = $this->actingAs($admin)->getJson('/api/v1/dashboard/summary')->assertOk();

        $trend = collect($res->json('data.trend_30d'));
        $this->assertSame(30, $trend->count());
        $this->assertSame(1, (int) $trend->firstWhere('date', $today)['hadir']);

        $perKelas = $res->json('data.per_kelas');
        $this->assertNotEmpty($perKelas);
        $this->assertSame(1, (int) array_sum(array_column($perKelas, 'hadir_hari_ini')));
    }

    public function test_portal_role_is_forbidden(): void
    {
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);

        $this->actingAs($siswa)
            ->getJson('/api/v1/dashboard/summary')
            ->assertForbidden();
    }
}
