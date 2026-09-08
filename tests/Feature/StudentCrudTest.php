<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class StudentCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_admin_can_create_read_update_delete_student(): void
    {
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        $class = ClassRoom::create(['name' => 'X RPL 1', 'grade' => 'X', 'major' => 'RPL']);
        $payload = ['nisn' => '1001', 'name' => 'Budi Santoso', 'class_room_id' => $class->id];

        $created = $this->actingAs($admin)->postJson('/api/v1/students', $payload)
            ->assertCreated()
            ->assertJsonPath('data.nisn', '1001')
            ->json('data.id');

        $this->actingAs($admin)->getJson("/api/v1/students/{$created}")
            ->assertOk()->assertJsonPath('data.name', 'Budi Santoso');

        $this->actingAs($admin)->putJson("/api/v1/students/{$created}", ['name' => 'Budi Updated'])
            ->assertOk()->assertJsonPath('data.name', 'Budi Updated');

        $super = $this->makeUser(RoleEnum::SuperAdmin->value);
        $this->actingAs($super)->deleteJson("/api/v1/students/{$created}")->assertOk();
        $this->assertDatabaseMissing('students', ['id' => $created]);
    }

    public function test_create_validates_duplicate_nisn_and_missing_name(): void
    {
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        Student::create(['nisn' => '2001', 'name' => 'Siti']);

        $this->actingAs($admin)->postJson('/api/v1/students', ['nisn' => '2001', 'name' => 'Duplikat'])
            ->assertStatus(422);

        $this->actingAs($admin)->postJson('/api/v1/students', ['nisn' => '2002'])
            ->assertStatus(422);
    }

    public function test_guru_cannot_create_and_admin_cannot_delete(): void
    {
        $guru = $this->makeUser(RoleEnum::Guru->value);
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '3001', 'name' => 'Andi']);

        $this->actingAs($guru)->postJson('/api/v1/students', ['nisn' => '3002', 'name' => 'Ditolak'])
            ->assertForbidden();

        $this->actingAs($admin)->deleteJson("/api/v1/students/{$student->id}")
            ->assertForbidden();
    }

    public function test_guest_cannot_access_students(): void
    {
        $this->getJson('/api/v1/students')->assertUnauthorized();
        $this->postJson('/api/v1/students', ['nisn' => 'x', 'name' => 'y'])->assertUnauthorized();
    }

    public function test_index_supports_search_and_pagination(): void
    {
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        Student::create(['nisn' => '4001', 'name' => 'Citra Lestari']);
        Student::create(['nisn' => '4002', 'name' => 'Dedi Kurniawan']);

        $this->actingAs($admin)->getJson('/api/v1/students?search=citra')
            ->assertOk()->assertJsonFragment(['nisn' => '4001']);

        $this->actingAs($admin)->getJson('/api/v1/students?per_page=1')
            ->assertOk()->assertJsonPath('meta.per_page', 1);
    }
}
