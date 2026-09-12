<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AcademicYearTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_academic_years_endpoint_returns_rows_instead_of_500(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);

        AcademicYear::create([
            'label' => '2025/2026',
            'starts_at' => '2025-07-01',
            'ends_at' => '2026-06-30',
            'active' => true,
        ]);
        AcademicYear::create([
            'label' => '2024/2025',
            'starts_at' => '2024-07-01',
            'ends_at' => '2025-06-30',
            'active' => false,
        ]);

        $res = $this->actingAs($admin)->getJson('/api/v1/academic/years')->assertOk();

        // Terbaru lebih dulu (orderByDesc starts_at).
        $res->assertJsonPath('data.0.label', '2025/2026')
            ->assertJsonPath('data.1.label', '2024/2025');
    }

    public function test_class_rooms_endpoint_works_with_academic_year_relation(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $year = AcademicYear::create([
            'label' => '2025/2026', 'starts_at' => '2025-07-01', 'ends_at' => '2026-06-30', 'active' => true,
        ]);

        ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL', 'academic_year_id' => $year->id]);

        $this->actingAs($admin)->getJson('/api/v1/academic/classes')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'X RPL 1');

        $this->assertSame(1, $year->classRooms()->count());
    }

    public function test_activating_a_year_keeps_exactly_one_active(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);

        $first = $this->actingAs($admin)->postJson('/api/v1/academic/years', [
            'label' => '2025/2026', 'starts_at' => '2025-07-01', 'ends_at' => '2026-06-30', 'active' => true,
        ])->assertCreated()->json('data');

        $second = $this->actingAs($admin)->postJson('/api/v1/academic/years', [
            'label' => '2026/2027', 'starts_at' => '2026-07-01', 'ends_at' => '2027-06-30',
        ])->assertCreated()->json('data');

        $this->assertSame(1, AcademicYear::where('active', true)->count());

        $this->actingAs($admin)->postJson("/api/v1/academic/years/{$second['id']}/activate")->assertOk();

        $this->assertSame(1, AcademicYear::where('active', true)->count());
        $this->assertTrue(AcademicYear::findOrFail($second['id'])->active);
        $this->assertFalse(AcademicYear::findOrFail($first['id'])->active);
    }

    public function test_year_in_use_cannot_be_deleted(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $year = AcademicYear::create([
            'label' => '2025/2026', 'starts_at' => '2025-07-01', 'ends_at' => '2026-06-30', 'active' => true,
        ]);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'academic_year_id' => $year->id]);
        Student::create(['nisn' => '9100000001', 'name' => 'Siswa', 'class_room_id' => $class->id]);

        $this->actingAs($admin)->deleteJson("/api/v1/academic/years/{$year->id}")
            ->assertStatus(409)
            ->assertJsonPath('errors.code', 'YEAR_IN_USE');

        // Tanpa siswa, penghapusan diizinkan.
        Student::where('class_room_id', $class->id)->delete();
        $this->actingAs($admin)->deleteJson("/api/v1/academic/years/{$year->id}")->assertOk();
    }
}
