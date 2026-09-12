<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Attendance;
use App\Models\Grade;
use App\Models\Guardian;
use App\Models\Invoice;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Services\FinanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ParentPortalTest extends TestCase
{
    use RefreshDatabase;

    private function makeGuardianParent(string $phone = '081200000001'): array
    {
        Role::firstOrCreate(['name' => RoleEnum::OrangTua->value, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(RoleEnum::OrangTua->value);
        $guardian = Guardian::create(['user_id' => $user->id, 'name' => 'Bpk. Uji', 'phone' => $phone]);

        return [$user, $guardian];
    }

    private function makeStudent(string $nisn, ?Guardian $guardian = null): Student
    {
        $student = Student::create(['nisn' => $nisn, 'name' => 'Anak '.$nisn]);
        $guardian?->students()->attach($student->id);

        return $student;
    }

    public function test_parent_lists_only_own_children(): void
    {
        [$user, $guardian] = $this->makeGuardianParent();
        $own = $this->makeStudent('7711', $guardian);
        $this->makeStudent('7722', $guardian);
        $this->makeStudent('7733'); // anak orang lain

        $this->actingAs($user)->getJson('/api/v1/parent/children')
            ->assertOk()
            ->assertJsonPath('data.children.0.nisn', $own->nisn)
            ->assertJsonCount(2, 'data.children');
    }

    public function test_parent_cannot_view_other_student_attendance(): void
    {
        [$user, $guardian] = $this->makeGuardianParent();
        $own = $this->makeStudent('7741', $guardian);
        $stranger = $this->makeStudent('7742');

        $this->actingAs($user)->getJson("/api/v1/parent/children/{$own->id}/attendance")->assertOk();
        $this->actingAs($user)->getJson("/api/v1/parent/children/{$stranger->id}/attendance")->assertForbidden();
    }

    public function test_non_parent_role_cannot_access_parent_portal(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::AdminTu->value, 'guard_name' => 'web']);
        $admin = User::factory()->create(['status' => 'active']);
        $admin->assignRole(RoleEnum::AdminTu->value);

        $this->actingAs($admin)->getJson('/api/v1/parent/children')->assertForbidden();
    }

    public function test_parent_attendance_records_are_scoped_and_filterable(): void
    {
        [$user, $guardian] = $this->makeGuardianParent();
        $student = $this->makeStudent('7751', $guardian);

        Attendance::create(['student_id' => $student->id, 'date' => '2026-09-01', 'status' => 'hadir', 'time_in' => '06:55:00', 'source' => 'qr']);
        Attendance::create(['student_id' => $student->id, 'date' => '2026-09-02', 'status' => 'terlambat', 'time_in' => '07:15:00', 'source' => 'qr']);

        $this->actingAs($user)->getJson("/api/v1/parent/children/{$student->id}/attendance?from=2026-09-02&to=2026-09-30")
            ->assertOk()
            ->assertJsonCount(1, 'data.records')
            ->assertJsonPath('data.records.0.status', 'terlambat');
    }

    public function test_parent_sees_own_child_invoices_scoped(): void
    {
        [$user, $guardian] = $this->makeGuardianParent();
        $own = $this->makeStudent('7761', $guardian);
        $stranger = $this->makeStudent('7762');

        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 500000]);
        app(FinanceService::class)->distribute($item, [$own->id, $stranger->id], '2026-09', null);

        // Anak sendiri: ringkasan + 1 invoice miliknya saja.
        $this->actingAs($user)->getJson("/api/v1/parent/children/{$own->id}/invoices")
            ->assertOk()
            ->assertJsonPath('data.total_tagihan', 500000)
            ->assertJsonCount(1, 'data.invoices');

        // Anak orang lain: 403 (IDOR horizontal dicegah).
        $this->actingAs($user)->getJson("/api/v1/parent/children/{$stranger->id}/invoices")
            ->assertForbidden();
    }

    public function test_parent_sees_only_published_grades_of_own_child(): void
    {
        [$user, $guardian] = $this->makeGuardianParent();
        $own = $this->makeStudent('7771', $guardian);
        $stranger = $this->makeStudent('7772');

        $subject = Subject::create(['code' => 'MTK-777', 'name' => 'Matematika']);
        $subject2 = Subject::create(['code' => 'IPA-777', 'name' => 'IPA']);
        Grade::create([
            'student_id' => $own->id, 'subject_id' => $subject->id,
            'nilai_tugas' => 80, 'nilai_uts' => 80, 'nilai_uas' => 80,
            'nilai_akhir' => 80, 'predikat' => 'B', 'published' => true,
        ]);
        Grade::create([
            'student_id' => $own->id, 'subject_id' => $subject2->id,
            'nilai_tugas' => 40, 'nilai_uts' => 40, 'nilai_uas' => 40,
            'nilai_akhir' => 40, 'predikat' => 'D', 'published' => false,
        ]);
        Grade::create([
            'student_id' => $stranger->id, 'subject_id' => $subject->id,
            'nilai_tugas' => 90, 'nilai_uts' => 90, 'nilai_uas' => 90,
            'nilai_akhir' => 90, 'predikat' => 'A', 'published' => true,
        ]);

        $this->actingAs($user)->getJson("/api/v1/parent/children/{$own->id}/grades")
            ->assertOk()
            ->assertJsonCount(1, 'data.grades')
            ->assertJsonPath('data.grades.0.nilai_akhir', 80);

        $this->actingAs($user)->getJson("/api/v1/parent/children/{$stranger->id}/grades")
            ->assertForbidden();
    }

    public function test_siswa_cannot_view_other_student_parent_invoices(): void
    {
        Role::firstOrCreate(['name' => RoleEnum::Siswa->value, 'guard_name' => 'web']);
        $siswa = User::factory()->create(['status' => 'active']);
        $siswa->assignRole(RoleEnum::Siswa->value);
        Student::create(['user_id' => $siswa->id, 'nisn' => '7781', 'name' => 'Siswa A']);
        $other = $this->makeStudent('7782');

        Invoice::create([
            'student_id' => $other->id, 'title' => 'SPP', 'amount' => 100000,
            'paid_amount' => 0, 'status' => 'unpaid',
        ]);

        // Bukan guardian (tanpa profil guardian) → 403, bukan data orang lain.
        $this->actingAs($siswa)->getJson("/api/v1/parent/children/{$other->id}/invoices")
            ->assertForbidden();
    }
}
