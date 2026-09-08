<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_password_never_exposed_in_responses(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::AdminTu->value, 'guard_name' => 'web']);
        $operator = $this->makeUser(RoleEnum::Operator->value);
        $operator->assignRole(RoleEnum::AdminTu->value);

        $login = $this->postJson('/api/v1/login', [
            'identifier' => $operator->email,
            'password' => 'password',
        ])->assertOk();

        $body = $login->getContent();
        $this->assertStringNotContainsString('password', strtolower($body));
        $this->assertArrayNotHasKey('password', $login->json('data.user'));

        $token = $login->json('data.token');
        $me = $this->withToken($token)->getJson('/api/v1/me')->assertOk();
        $this->assertArrayNotHasKey('password', $me->json('data'));
    }

    public function test_nik_masked_from_student_payload(): void
    {
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        $student = Student::create(['nisn' => '9001', 'name' => 'Uji', 'nik' => 'sangat-rahasia']);

        $this->actingAs($admin)->getJson("/api/v1/students/{$student->id}")
            ->assertOk()->assertJsonMissing(['nik' => 'sangat-rahasia']);
    }

    public function test_idor_siswa_cannot_read_other_student(): void
    {
        $siswaRole = RoleEnum::Siswa->value;
        $userA = $this->makeUser($siswaRole);
        $userB = $this->makeUser($siswaRole);
        $studentA = Student::create(['nisn' => '9101', 'name' => 'A', 'user_id' => $userA->id]);
        $studentB = Student::create(['nisn' => '9102', 'name' => 'B', 'user_id' => $userB->id]);

        $this->actingAs($userA)->getJson("/api/v1/students/{$studentA->id}")->assertOk();
        $this->actingAs($userA)->getJson("/api/v1/students/{$studentB->id}")->assertForbidden();
    }

    public function test_vertical_escalation_operator_cannot_manage_students(): void
    {
        $operator = $this->makeUser(RoleEnum::Operator->value);
        $student = Student::create(['nisn' => '9201', 'name' => 'C']);

        $this->actingAs($operator)->postJson('/api/v1/students', ['nisn' => '9202', 'name' => 'X'])
            ->assertForbidden();
        $this->actingAs($operator)->putJson("/api/v1/students/{$student->id}", ['name' => 'Y'])
            ->assertForbidden();
        $this->actingAs($operator)->deleteJson("/api/v1/students/{$student->id}")
            ->assertForbidden();
    }

    public function test_inactive_user_cannot_login(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::Guru->value, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'inactive']);
        $user->assignRole(RoleEnum::Guru->value);

        $this->postJson('/api/v1/login', ['identifier' => $user->email, 'password' => 'password'])
            ->assertStatus(401)->assertJsonPath('errors.code', 'AUTH_REQUIRED');
    }

    public function test_sql_injection_in_search_is_neutralized(): void
    {
        $admin = $this->makeUser(RoleEnum::AdminTu->value);
        Student::create(['nisn' => '9301', 'name' => 'Aman']);

        $this->actingAs($admin)->getJson('/api/v1/students?search=%27%20OR%20%271%27%3D%271')
            ->assertOk();

        $this->assertDatabaseCount('students', 1);
    }

    public function test_otp_replay_and_wrong_code_rejected(): void
    {
        $req = $this->postJson('/api/v1/otp/request', ['identifier' => 'PENTEST-1'])->assertOk();
        $code = $req->json('data.debug_code');

        $this->postJson('/api/v1/otp/verify', ['identifier' => 'PENTEST-1', 'code' => '000000'])
            ->assertStatus(401);

        $this->postJson('/api/v1/otp/verify', ['identifier' => 'PENTEST-1', 'code' => $code])
            ->assertOk();

        $this->postJson('/api/v1/otp/verify', ['identifier' => 'PENTEST-1', 'code' => $code])
            ->assertStatus(401);
    }

    public function test_unauthorized_attendance_report_blocked(): void
    {
        $siswa = $this->makeUser(RoleEnum::Siswa->value);
        $class = ClassRoom::create(['name' => 'X', 'grade' => 'X']);
        Student::create(['nisn' => '9401', 'name' => 'D', 'class_room_id' => $class->id, 'user_id' => $siswa->id]);

        $this->actingAs($siswa)->getJson('/api/v1/attendance/reports?from=2026-01-01&to=2026-12-31')
            ->assertForbidden();
    }
}
