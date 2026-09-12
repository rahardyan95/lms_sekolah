<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\AcademicYear;
use App\Models\CashTransaction;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Matriks CRUD: setiap entitas yang punya endpoint tulis diuji sampai
 * Create → Read → Update → Delete, bukan hanya "berhasil dibuat".
 */
class CrudMatrixTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        Role::firstOrCreate(['name' => RoleEnum::SuperAdmin->value, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole(RoleEnum::SuperAdmin->value);

        return $user;
    }

    public function test_cms_post_full_crud_cycle(): void
    {
        $admin = $this->superAdmin();

        $created = $this->actingAs($admin)->postJson('/api/v1/cms/posts', [
            'title' => 'Berita CRUD', 'content' => '<p>Isi awal</p>', 'status' => 'draft',
        ])->assertCreated()->json('data');

        $this->assertContains('Berita CRUD', $this->manageTitles($admin));
        $this->assertSame('draft', $created['status']);

        $updated = $this->actingAs($admin)->putJson("/api/v1/cms/posts/{$created['id']}", [
            'title' => 'Berita CRUD Revisi', 'status' => 'published',
        ])->assertOk()->json('data');

        $this->assertSame('Berita CRUD Revisi', $updated['title']);
        $this->assertSame('published', $updated['status']);
        $this->assertNotNull($updated['published_at']);
        $this->assertContains('Berita CRUD Revisi', $this->manageTitles($admin));

        $this->actingAs($admin)->deleteJson("/api/v1/cms/posts/{$created['id']}")->assertOk();

        $this->assertNotContains('Berita CRUD Revisi', $this->manageTitles($admin));
        $this->assertDatabaseMissing('posts', ['id' => $created['id']]);
    }

    public function test_academic_year_full_crud_cycle(): void
    {
        $admin = $this->superAdmin();

        $created = $this->actingAs($admin)->postJson('/api/v1/academic/years', [
            'label' => '2030/2031', 'starts_at' => '2030-07-01', 'ends_at' => '2031-06-30',
        ])->assertCreated()->json('data');

        $this->assertFalse((bool) $created['active']);

        $updated = $this->actingAs($admin)->putJson("/api/v1/academic/years/{$created['id']}", [
            'label' => '2030/2031 (revisi)',
        ])->assertOk()->json('data');

        $this->assertSame('2030/2031 (revisi)', $updated['label']);

        $this->actingAs($admin)->postJson("/api/v1/academic/years/{$created['id']}/activate")
            ->assertOk()->assertJsonPath('data.active', true);

        $this->assertSame(1, AcademicYear::where('active', true)->count());

        $this->actingAs($admin)->deleteJson("/api/v1/academic/years/{$created['id']}")->assertOk();
        $this->assertDatabaseMissing('academic_years', ['id' => $created['id']]);
    }

    public function test_schedule_full_crud_cycle(): void
    {
        $admin = $this->superAdmin();

        $created = $this->actingAs($admin)->postJson('/api/v1/academic/schedules', [
            'day' => 'Senin', 'time_start' => '07:00', 'time_end' => '08:30',
            'kelas' => 'X RPL 1', 'subject_name' => 'Matematika', 'teacher_name' => 'Bu Ani',
        ])->assertCreated()->json('data');

        $listed = $this->actingAs($admin)->getJson('/api/v1/academic/schedules?kelas=X%20RPL%201')
            ->assertOk()->json('data.data');
        $this->assertCount(1, $listed);

        $updated = $this->actingAs($admin)->putJson("/api/v1/academic/schedules/{$created['id']}", [
            'room' => 'Lab 2', 'time_end' => '09:00',
        ])->assertOk()->json('data');

        $this->assertSame('Lab 2', $updated['room']);

        $this->actingAs($admin)->deleteJson("/api/v1/academic/schedules/{$created['id']}")->assertOk();
        $this->assertDatabaseMissing('schedules', ['id' => $created['id']]);
    }

    public function test_cash_transactions_create_read_and_report(): void
    {
        $admin = $this->superAdmin();
        $today = now()->format('Y-m-d');

        $income = $this->actingAs($admin)->postJson('/api/v1/finance/cash', [
            'type' => 'income', 'category' => 'Donasi', 'amount' => 250000,
            'transaction_at' => $today, 'proof' => 'bukti-1.pdf',
        ])->assertCreated()->json('data');

        $expense = $this->actingAs($admin)->postJson('/api/v1/finance/cash', [
            'type' => 'expense', 'category' => 'ATK', 'amount' => 50000, 'transaction_at' => $today,
        ])->assertCreated()->json('data');

        $this->assertSame('income', $income['type']);
        $this->assertSame($admin->name, $income['pic']);

        $all = $this->actingAs($admin)->getJson('/api/v1/finance/cash')->assertOk()->json('data.data');
        $this->assertCount(2, $all);

        $onlyIncome = $this->actingAs($admin)->getJson('/api/v1/finance/cash?type=income')
            ->assertOk()->json('data.data');
        $this->assertCount(1, $onlyIncome);
        $this->assertSame($income['id'], $onlyIncome[0]['id']);

        $report = $this->actingAs($admin)->getJson("/api/v1/finance/reports/cash?from={$today}&to={$today}")
            ->assertOk()->json('data');
        $this->assertSame(250000, $report['income']);
        $this->assertSame(50000, $report['expense']);

        $this->assertSame(2, CashTransaction::count());
        $this->assertSame(50000, CashTransaction::findOrFail($expense['id'])->amount);
        $this->assertSame('ATK', CashTransaction::findOrFail($expense['id'])->category);
    }

    public function test_settings_create_then_update_bumps_version(): void
    {
        $admin = $this->superAdmin();

        $first = $this->actingAs($admin)->putJson('/api/v1/settings/school_name', ['value' => 'SMK Satu'])
            ->assertOk()->json('data');
        // Baris dibuat dengan version 1 lalu langsung ditulis → version 2.
        $this->assertSame(2, $first['version']);

        $this->assertSame('SMK Satu', $this->actingAs($admin)->getJson('/api/v1/settings')->json('data.school_name'));

        $second = $this->actingAs($admin)->putJson('/api/v1/settings/school_name', [
            'value' => 'SMK Dua', 'version' => 2,
        ])->assertOk()->json('data');
        $this->assertSame(3, $second['version']);

        $this->assertSame('SMK Dua', $this->actingAs($admin)->getJson('/api/v1/settings')->json('data.school_name'));
        $this->assertSame(1, DB::table('school_settings')->where('key', 'school_name')->count());
    }

    public function test_invoice_adjustment_creates_a_new_row_not_an_edit(): void
    {
        $admin = $this->superAdmin();
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 400000]);
        $student = Student::create(['nisn' => '8800000001', 'name' => 'Bunga']);

        $invoice = Invoice::create([
            'student_id' => $student->id, 'item_id' => $item->id,
            'title' => 'SPP', 'period' => '2030-01', 'amount' => 400000,
        ]);

        $payment = $this->actingAs($admin)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 150000, 'method' => 'tunai', 'reference' => 'REF-CRUD-1',
        ])->assertCreated()->json('data');

        $adjustment = $this->actingAs($admin)->postJson("/api/v1/finance/invoices/{$invoice->id}/adjust", [
            'amount' => -50000, 'reason' => 'Koreksi kelebihan input',
        ])->assertCreated()->json('data');

        $this->assertNotSame($payment['id'], $adjustment['id']);
        $this->assertSame(-50000, $adjustment['amount']);

        // Baris asli tidak berubah; saldo tagihan mengikuti penjumlahan.
        $this->assertSame(150000, Payment::findOrFail($payment['id'])->amount);
        $this->assertSame(100000, $invoice->refresh()->paid_amount);
        $this->assertSame('partial', $invoice->status);
        $this->assertSame(2, Payment::count());
    }

    /** @return array<int, string> */
    private function manageTitles(User $admin): array
    {
        return $this->actingAs($admin)->getJson('/api/v1/cms/admin/posts')
            ->assertOk()
            ->json('data.data.*.title');
    }
}
