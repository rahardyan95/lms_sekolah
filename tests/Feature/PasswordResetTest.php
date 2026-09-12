<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_password_updates_password_and_revokes_old_tokens(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::Operator->value, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(RoleEnum::Operator->value);

        $oldToken = $user->createToken('spa')->plainTextToken;
        $resetToken = Password::broker()->createToken($user);

        $this->postJson('/api/v1/password/reset', [
            'email' => $user->email,
            'token' => $resetToken,
            'password' => 'passwordBaru123',
            'password_confirmation' => 'passwordBaru123',
        ])->assertOk();

        // Password lama tidak berlaku lagi, yang baru berlaku.
        $this->postJson('/api/v1/login', ['identifier' => $user->email, 'password' => 'password'])
            ->assertStatus(401);
        $this->postJson('/api/v1/login', ['identifier' => $user->email, 'password' => 'passwordBaru123'])
            ->assertOk();

        // Semua token Sanctum lama dicabut.
        $this->withToken($oldToken)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_reset_with_invalid_token_is_rejected_generically(): void
    {
        $user = User::factory()->create(['status' => 'active']);

        $this->postJson('/api/v1/password/reset', [
            'email' => $user->email,
            'token' => 'token-palsu',
            'password' => 'passwordBaru123',
            'password_confirmation' => 'passwordBaru123',
        ])->assertStatus(422)->assertJsonPath('errors.code', 'INVALID_RESET_TOKEN');
    }
}
