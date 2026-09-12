<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use App\Services\DemoAccountService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DemoAccountTest extends TestCase
{
    use RefreshDatabase;

    private function seedPermissions(): void
    {
        foreach (RoleEnum::cases() as $role) {
            Role::firstOrCreate(['name' => $role->value, 'guard_name' => 'web']);
        }
    }

    public function test_seed_all_creates_eight_demo_accounts(): void
    {
        $this->seedPermissions();

        $report = app(DemoAccountService::class)->seedAll();

        $this->assertSame(8, $report->count());

        foreach (['superadmin@sekolah.sch.id', 'siswa.demo@sekolah.sch.id', 'ortu.demo@sekolah.sch.id', 'spmb.demo@sekolah.sch.id'] as $email) {
            $this->assertNotNull(User::where('email', $email)->first(), "missing {$email}");
        }

        $student = Student::where('nisn', DemoAccountService::DEMO_STUDENT_NISN)->first();
        $this->assertNotNull($student);

        $guardian = Guardian::whereHas('students', fn ($q) => $q->where('students.id', $student->id))->first();
        $this->assertNotNull($guardian);
        $this->assertTrue($guardian->user->hasRole(RoleEnum::OrangTua->value));
    }

    public function test_seed_is_idempotent(): void
    {
        $this->seedPermissions();

        app(DemoAccountService::class)->seedAll();
        $report = app(DemoAccountService::class)->seedAll();

        $this->assertSame(8, $report->count());
        $this->assertSame(8, User::where('email', 'like', '%@sekolah.sch.id')->count());
    }

    public function test_all_password_logins_return_correct_portal(): void
    {
        $this->seedPermissions();
        app(DemoAccountService::class)->seedAll();
        $password = (string) env('SEED_DEMO_PASSWORD', 'password123');

        $cases = [
            'superadmin@sekolah.sch.id' => 'dashboard',
            'admin@sekolah.sch.id' => 'dashboard',
            'guru@sekolah.sch.id' => 'academic',
            'bendahara@sekolah.sch.id' => 'finance',
            'operator@sekolah.sch.id' => 'attendance',
            DemoAccountService::DEMO_STUDENT_NISN => 'student',
            DemoAccountService::DEMO_SPMB_REGNO => 'spmb',
        ];

        foreach ($cases as $identifier => $portal) {
            $this->postJson('/api/v1/login', ['identifier' => $identifier, 'password' => $password])
                ->assertOk()
                ->assertJsonPath('data.portal', $portal);
        }
    }

    public function test_demo_parent_otp_returns_token(): void
    {
        $this->seedPermissions();
        app(DemoAccountService::class)->seedAll();

        $req = $this->postJson('/api/v1/otp/request', ['identifier' => DemoAccountService::DEMO_STUDENT_NISN])->assertOk();
        $code = $req->json('data.debug_code');
        $this->assertNotEmpty($code);

        $this->postJson('/api/v1/otp/verify', [
            'identifier' => DemoAccountService::DEMO_STUDENT_NISN,
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('data.portal', 'parent')
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }
}
