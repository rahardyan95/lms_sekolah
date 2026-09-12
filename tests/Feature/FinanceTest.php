<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_distribute_is_idempotent(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP Juli', 'category' => 'SPP', 'amount' => 500000]);
        $a = Student::create(['nisn' => '9001', 'name' => 'A']);
        $b = Student::create(['nisn' => '9002', 'name' => 'B']);

        $payload = ['student_ids' => [$a->id, $b->id], 'period' => '2026-07'];

        $this->actingAs($staff)->postJson("/api/v1/finance/items/{$item->id}/distribute", $payload)
            ->assertCreated()
            ->assertJsonPath('data.created', 2);

        $this->actingAs($staff)->postJson("/api/v1/finance/items/{$item->id}/distribute", $payload)
            ->assertCreated()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.skipped', 2);

        $this->assertSame(2, Invoice::count());
    }

    public function test_distribute_without_period_is_idempotent(): void
    {
        $bendahara = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 100000]);
        $student = Student::create(['nisn' => '9900000001', 'name' => 'S']);

        $body = ['student_ids' => [$student->id]];

        $this->actingAs($bendahara)->postJson("/api/v1/finance/items/{$item->id}/distribute", $body)
            ->assertCreated()->assertJsonPath('data.created', 1);

        $this->actingAs($bendahara)->postJson("/api/v1/finance/items/{$item->id}/distribute", $body)
            ->assertCreated()->assertJsonPath('data.created', 0);

        $this->assertSame(1, Invoice::where('student_id', $student->id)->count());
    }

    public function test_partial_then_full_payment_transitions_status(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 500000]);
        $student = Student::create(['nisn' => '9003', 'name' => 'C']);

        $this->actingAs($staff)->postJson("/api/v1/finance/items/{$item->id}/distribute", [
            'student_ids' => [$student->id], 'period' => '2026-08',
        ])->assertCreated();
        $invoice = Invoice::first();

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 200000, 'method' => 'tunai', 'reference' => 'REF-001',
        ])->assertCreated()->assertJsonStructure(['data' => ['receipt_number']]);

        $this->assertSame('partial', $invoice->refresh()->status);

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 300000, 'method' => 'transfer', 'reference' => 'REF-002',
        ])->assertCreated();

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(500000, (int) $invoice->paid_amount);
    }

    public function test_overpay_rejected_and_reference_conflict(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 100000]);
        $student = Student::create(['nisn' => '9004', 'name' => 'D']);
        $invoice = Invoice::create([
            'student_id' => $student->id, 'item_id' => $item->id,
            'title' => 'SPP', 'amount' => 100000,
        ]);

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 150000, 'method' => 'tunai', 'reference' => 'REF-X',
        ])->assertStatus(422)->assertJsonPath('errors.code', 'VALIDATION');

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 50000, 'method' => 'tunai', 'reference' => 'REF-Y',
        ])->assertCreated();

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 10000, 'method' => 'tunai', 'reference' => 'REF-Y',
        ])->assertStatus(409)->assertJsonPath('errors.code', 'CONFLICT');
    }

    public function test_guru_cannot_manage_and_parent_scoped_read(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/finance/items', [
            'name' => 'X', 'amount' => 1000,
        ])->assertForbidden();

        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $student = Student::create(['nisn' => '9005', 'name' => 'E']);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 500000]);
        Invoice::create(['student_id' => $student->id, 'item_id' => $item->id, 'title' => 'SPP', 'amount' => 500000]);

        // Orang tua tanpa relasi tidak boleh intip tagihan anak lain.
        $parent = $this->userWithRole(RoleEnum::OrangTua->value);
        $this->actingAs($parent)->getJson("/api/v1/finance/invoices?student_id={$student->id}")
            ->assertForbidden();
    }

    public function test_receipt_contains_unique_number(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 200000]);
        $s1 = Student::create(['nisn' => '9006', 'name' => 'F']);
        $s2 = Student::create(['nisn' => '9007', 'name' => 'G']);

        foreach ([$s1, $s2] as $i => $s) {
            $inv = Invoice::create([
                'student_id' => $s->id, 'item_id' => $item->id,
                'title' => 'SPP', 'period' => "2026-0{$i}", 'amount' => 200000,
            ]);
            $res = $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$inv->id}/payments", [
                'amount' => 200000, 'method' => 'qris', 'reference' => "REF-R{$i}",
            ])->assertCreated();
            $this->assertNotEmpty($res->json('data.receipt_number'));
        }

        $this->assertSame(2, Payment::distinct('receipt_number')->count('receipt_number'));
    }

    public function test_cash_report_balances_and_reversal_keeps_original_row(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $today = now()->format('Y-m-d');

        $this->actingAs($staff)->postJson('/api/v1/finance/cash', [
            'type' => 'income', 'category' => 'Donasi', 'amount' => 300000, 'transaction_at' => $today,
        ])->assertCreated();

        $this->actingAs($staff)->postJson('/api/v1/finance/cash', [
            'type' => 'expense', 'category' => 'ATK', 'amount' => 100000, 'transaction_at' => $today,
        ])->assertCreated();

        $report = $this->actingAs($staff)
            ->getJson("/api/v1/finance/reports/cash?from={$today}&to={$today}")
            ->assertOk()->json('data');

        $this->assertSame(300000, $report['income']);
        $this->assertSame(100000, $report['expense']);
        $this->assertSame($report['opening'] + $report['income'] - $report['expense'], $report['closing']);

        // Pembalikan: baris asli tidak berubah, baris penyesuaian negatif dibuat.
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 500000]);
        $student = Student::create(['nisn' => '9010', 'name' => 'H']);
        $invoice = Invoice::create([
            'student_id' => $student->id, 'item_id' => $item->id,
            'title' => 'SPP', 'period' => '2026-09', 'amount' => 500000,
        ]);

        $payment = $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 200000, 'method' => 'tunai', 'reference' => 'REF-REV-1',
        ])->assertCreated()->json('data');

        $this->assertSame('partial', $invoice->refresh()->status);
        $this->assertSame(200000, $invoice->paid_amount);

        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/adjust", [
            'amount' => -200000, 'reason' => 'Salah input nominal',
        ])->assertCreated();

        // Baris pembayaran asli tetap ada dan tetap positif.
        $original = Payment::findOrFail($payment['id']);
        $this->assertSame(200000, $original->amount);
        $this->assertSame(0, $invoice->refresh()->paid_amount);
        $this->assertSame('unpaid', $invoice->status);
    }

    public function test_receipt_pdf_downloads_pdf(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 100000]);
        $student = Student::create(['nisn' => '9011', 'name' => 'I']);
        $invoice = Invoice::create([
            'student_id' => $student->id, 'item_id' => $item->id,
            'title' => 'SPP', 'period' => '2026-10', 'amount' => 100000,
        ]);

        $payment = $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 100000, 'method' => 'tunai', 'reference' => 'REF-PDF-1',
        ])->assertCreated()->json('data');

        $res = $this->actingAs($staff)->get("/api/v1/finance/payments/{$payment['id']}/receipt.pdf")->assertOk();

        $this->assertStringContainsString('application/pdf', (string) $res->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF-', (string) $res->getContent());
    }

    public function test_bank_account_number_is_encrypted_at_rest_and_masked_in_api(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);

        $account = $this->actingAs($staff)->postJson('/api/v1/finance/bank-accounts', [
            'bank' => 'BCA', 'account_number' => '1234567890123456', 'holder' => 'SMKN 1',
        ])->assertCreated()->json('data');

        $this->assertSame('****3456', $account['account_masked']);
        $this->assertArrayNotHasKey('account_number', $account);

        $raw = DB::table('bank_accounts')->where('id', $account['id'])->value('account_number');
        $this->assertStringNotContainsString('1234567890123456', (string) $raw);

        $list = $this->actingAs($staff)->getJson('/api/v1/finance/bank-accounts')->assertOk()->json('data');
        $this->assertSame('****3456', $list[0]['account_masked']);
        $this->assertArrayNotHasKey('account_number', $list[0]);
    }
}
