<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
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
}
