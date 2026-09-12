<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Http\Middleware\WebTokenCookie;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class HybridSessionTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function webLogin(User $user): array
    {
        $res = $this->postJson('/api/v1/login', [
            'identifier' => $user->email, 'password' => 'password',
        ], [WebTokenCookie::CLIENT_HEADER => '1']);

        $res->assertOk();
        $cookie = collect($res->headers->getCookies())
            ->first(fn ($c) => $c->getName() === WebTokenCookie::COOKIE);

        $this->assertNotNull($cookie, 'cookie lms_web harus diset untuk klien web');
        $this->assertTrue($cookie->isHttpOnly());

        return [$res->json('data.token'), $cookie->getValue()];
    }

    public function test_web_login_sets_httponly_cookie_and_bearer_still_returned(): void
    {
        $this->userWithRole(RoleEnum::Operator->value);
        $this->webLogin(User::first());
    }

    public function test_cookie_only_request_authenticates(): void
    {
        $user = $this->userWithRole(RoleEnum::Operator->value);
        [, $cookieValue] = $this->webLogin($user);

        $this->getJson('/api/v1/me', [WebTokenCookie::CLIENT_HEADER => '1'])
            ->assertUnauthorized();

        $this->withUnencryptedCookie(WebTokenCookie::COOKIE, $cookieValue)
            ->withCredentials()
            ->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
    }

    public function test_cookie_mutation_requires_csrf_pair(): void
    {
        $user = $this->userWithRole(RoleEnum::Operator->value);
        [, $cookieValue] = $this->webLogin($user);

        // Tanpa pasangan CSRF → 419.
        $this->withUnencryptedCookie(WebTokenCookie::COOKIE, $cookieValue)
            ->withCredentials()
            ->postJson('/api/v1/logout')
            ->assertStatus(419);

        // CSRF tidak cocok → 419.
        $this->withUnencryptedCookie(WebTokenCookie::COOKIE, $cookieValue)
            ->withUnencryptedCookie(WebTokenCookie::CSRF_COOKIE, 'a')
            ->withCredentials()
            ->postJson('/api/v1/logout', [], [WebTokenCookie::CSRF_HEADER => 'b'])
            ->assertStatus(419);

        // Pasangan cocok → lolos, token dicabut, cookie dihapus.
        $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $xsrf = collect($this->get('/sanctum/csrf-cookie')->headers->getCookies())
            ->first(fn ($c) => $c->getName() === WebTokenCookie::CSRF_COOKIE);

        $logout = $this->withUnencryptedCookie(WebTokenCookie::COOKIE, $cookieValue)
            ->withUnencryptedCookie(WebTokenCookie::CSRF_COOKIE, $xsrf->getValue())
            ->withCredentials()
            ->postJson('/api/v1/logout', [], [WebTokenCookie::CSRF_HEADER => $xsrf->getValue()]);
        $logout->assertOk();

        $cleared = collect($logout->headers->getCookies())->first(fn ($c) => $c->getName() === WebTokenCookie::COOKIE);
        $this->assertNotNull($cleared);
        $this->assertTrue($cleared->isCleared());
    }

    public function test_bearer_flow_unchanged_without_web_header(): void
    {
        $user = $this->userWithRole(RoleEnum::Operator->value);

        $res = $this->postJson('/api/v1/login', [
            'identifier' => $user->email, 'password' => 'password',
        ])->assertOk();

        $this->assertNull(
            collect($res->headers->getCookies())->first(fn ($c) => $c->getName() === WebTokenCookie::COOKIE)
        );

        $this->getJson('/api/v1/me', [
            'Authorization' => 'Bearer '.$res->json('data.token'),
        ])->assertOk();
    }

    public function test_parent_cannot_read_other_guardian_child(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::OrangTua->value, 'guard_name' => 'web']);

        $parentA = User::factory()->create(['status' => 'active']);
        $parentA->assignRole(RoleEnum::OrangTua->value);
        $guardianA = Guardian::create(['user_id' => $parentA->id, 'name' => 'A', 'phone' => '081200000011']);
        $studentA = Student::create(['nisn' => '5500000001', 'name' => 'Anak A']);
        $studentA->guardians()->attach($guardianA->id);

        $parentB = User::factory()->create(['status' => 'active']);
        $parentB->assignRole(RoleEnum::OrangTua->value);
        $guardianB = Guardian::create(['user_id' => $parentB->id, 'name' => 'B', 'phone' => '081200000022']);
        $studentB = Student::create(['nisn' => '5500000002', 'name' => 'Anak B']);
        $studentB->guardians()->attach($guardianB->id);

        // A membaca anak B → 403; anak sendiri → 200.
        $this->actingAs($parentA)->getJson("/api/v1/parent/children/{$studentB->id}/attendance")
            ->assertForbidden();
        $this->actingAs($parentA)->getJson("/api/v1/parent/children/{$studentA->id}/attendance")
            ->assertOk();
    }
}
