<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminCreateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
    }

    public function test_creates_first_super_admin(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Budi Santoso',
            '--email' => 'budi@sekolah.sch.id',
            '--password' => 'RahasiaKuat2026',
        ])->assertSuccessful();

        $user = User::query()->where('email', 'budi@sekolah.sch.id')->firstOrFail();

        $this->assertSame('budi@sekolah.sch.id', $user->identifier);
        $this->assertSame('active', $user->status);
        $this->assertTrue($user->hasRole('super_admin'));
        $this->assertNotSame('RahasiaKuat2026', $user->password);
    }

    public function test_rejects_weak_password(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Budi Santoso',
            '--email' => 'budi@sekolah.sch.id',
            '--password' => 'pendek123',
        ])->assertFailed();

        $this->assertDatabaseMissing('users', ['email' => 'budi@sekolah.sch.id']);
    }

    public function test_rejects_duplicate_email(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Budi Santoso',
            '--email' => 'budi@sekolah.sch.id',
            '--password' => 'RahasiaKuat2026',
        ])->assertSuccessful();

        $this->artisan('admin:create', [
            '--name' => 'Budi Lain',
            '--email' => 'budi@sekolah.sch.id',
            '--password' => 'RahasiaKuat2026',
        ])->assertFailed();

        $this->assertSame(1, User::query()->where('email', 'budi@sekolah.sch.id')->count());
    }
}
