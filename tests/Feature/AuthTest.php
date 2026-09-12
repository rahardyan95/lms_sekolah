<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_wrong_credential_returns_401(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'identifier' => 'tidakada@sekolah.sch.id',
            'password' => 'salah123',
        ]);

        $response->assertStatus(401)->assertJsonPath('errors.code', 'AUTH_REQUIRED');
    }

    public function test_login_valid_returns_token_and_portal(): void
    {
        Role::create(['name' => RoleEnum::Operator->value, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(RoleEnum::Operator->value);

        $response = $this->postJson('/api/v1/login', [
            'identifier' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.portal', 'attendance')
            ->assertJsonStructure(['data' => ['token', 'user'], 'request_id']);
    }

    public function test_me_requires_auth(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_otp_request_and_verify(): void
    {
        $req = $this->postJson('/api/v1/otp/request', ['identifier' => 'NISN-001']);
        $req->assertOk();
        $code = $req->json('data.debug_code');
        $this->assertNotEmpty($code);

        $this->postJson('/api/v1/otp/verify', [
            'identifier' => 'NISN-001',
            'code' => $code,
        ])->assertOk()->assertJsonPath('data.verified', true);

        $this->postJson('/api/v1/otp/verify', [
            'identifier' => 'NISN-001',
            'code' => $code,
        ])->assertStatus(401);
    }

    public function test_login_matrix_roles_return_correct_portal(): void
    {
        $cases = [
            RoleEnum::SuperAdmin->value => 'dashboard',
            RoleEnum::AdminTu->value => 'dashboard',
            RoleEnum::Guru->value => 'academic',
            RoleEnum::Bendahara->value => 'finance',
            RoleEnum::Operator->value => 'attendance',
            RoleEnum::Siswa->value => 'student',
            RoleEnum::CalonSiswa->value => 'spmb',
        ];

        foreach ($cases as $role => $portal) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
            $user = User::factory()->create(['status' => 'active']);
            $user->assignRole($role);

            $this->postJson('/api/v1/login', ['identifier' => $user->email, 'password' => 'password'])
                ->assertOk()
                ->assertJsonPath('data.portal', $portal);
        }
    }

    public function test_parent_otp_login_returns_parent_portal_token(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::OrangTua->value, 'guard_name' => 'web']);
        $parent = User::factory()->create(['status' => 'active']);
        $parent->assignRole(RoleEnum::OrangTua->value);

        $guardian = Guardian::create(['user_id' => $parent->id, 'name' => 'Bpk. Uji', 'phone' => '081200000001']);
        $student = Student::create(['nisn' => '8881', 'name' => 'Anak Uji']);
        $student->guardians()->attach($guardian->id);

        $req = $this->postJson('/api/v1/otp/request', ['identifier' => '8881'])->assertOk();
        $code = $req->json('data.debug_code');
        $this->assertNotEmpty($code);

        $this->postJson('/api/v1/otp/verify', ['identifier' => '8881', 'code' => $code])
            ->assertOk()
            ->assertJsonPath('data.verified', true)
            ->assertJsonPath('data.portal', 'parent')
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_otp_bruteforce_locked_after_five_attempts(): void
    {
        $req = $this->postJson('/api/v1/otp/request', ['identifier' => 'NISN-002'])->assertOk();
        $code = $req->json('data.debug_code');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/otp/verify', ['identifier' => 'NISN-002', 'code' => '000000'])
                ->assertStatus(401);
        }

        // Setelah lockout, kode yang benar pun ditolak.
        $this->postJson('/api/v1/otp/verify', ['identifier' => 'NISN-002', 'code' => $code])
            ->assertStatus(401);
    }
}
