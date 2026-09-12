<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Invoice;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FinanceCashSplitTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_cash_report_splits_cash_and_bank_channels(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);
        $student = Student::create(['nisn' => '9100000001', 'name' => 'Split Kanal']);
        $item = PaymentItem::create(['name' => 'SPP', 'category' => 'SPP', 'amount' => 1000000]);
        $invoice = Invoice::create([
            'student_id' => $student->id, 'item_id' => $item->id, 'title' => 'SPP', 'amount' => 1000000,
        ]);

        $account = $this->actingAs($staff)->postJson('/api/v1/finance/bank-accounts', [
            'bank' => 'BCA', 'account_number' => '1234567890123456', 'holder' => 'SMK Negeri 1',
        ])->assertCreated()->json('data');

        // Pembayaran tunai (kanal kas) + transfer (kanal rekening).
        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 200000, 'method' => 'tunai', 'reference' => 'REF-SPLIT-1',
        ])->assertCreated();
        $this->actingAs($staff)->postJson("/api/v1/finance/invoices/{$invoice->id}/payments", [
            'amount' => 300000, 'method' => 'transfer', 'reference' => 'REF-SPLIT-2',
        ])->assertCreated();

        // Kas: pemasukan masuk rekening, pengeluaran dari kas tunai.
        $today = now()->toDateString();
        $this->actingAs($staff)->postJson('/api/v1/finance/cash', [
            'type' => 'income', 'category' => 'Bantuan', 'amount' => 500000,
            'transaction_at' => $today, 'bank_account_id' => $account['id'],
        ])->assertCreated();
        $this->actingAs($staff)->postJson('/api/v1/finance/cash', [
            'type' => 'expense', 'category' => 'ATK', 'amount' => 100000,
            'transaction_at' => $today,
        ])->assertCreated();

        $from = now()->subDay()->toDateString();
        $to = now()->addDay()->toDateString();
        $data = $this->actingAs($staff)
            ->getJson("/api/v1/finance/reports/cash?from={$from}&to={$to}")
            ->assertOk()
            ->json('data');

        $byKey = collect($data['by_account'])->keyBy(fn (array $row) => $row['id'] ?? 'kas');

        $this->assertTrue($byKey->has('kas'), 'kanal Kas Tunai harus ada');
        $this->assertSame(200000, (int) $byKey['kas']['income']);
        $this->assertSame(100000, (int) $byKey['kas']['expense']);

        $bank = $byKey[$account['id']];
        $this->assertSame(800000, (int) $bank['income'], 'transfer 300k + kas masuk rekening 500k');
        $this->assertSame(0, (int) $bank['expense']);
        $this->assertStringContainsString('BCA', (string) $bank['label']);

        // Invariant: penjumlahan seluruh kanal == agregat laporan.
        $this->assertSame((int) $data['income'], (int) collect($data['by_account'])->sum('income'));
        $this->assertSame((int) $data['expense'], (int) collect($data['by_account'])->sum('expense'));
        $this->assertSame((int) $data['opening'], (int) collect($data['by_account'])->sum('opening'));
        $this->assertSame((int) $data['closing'], (int) collect($data['by_account'])->sum('closing'));
    }

    public function test_cash_entry_rejects_unknown_bank_account(): void
    {
        $staff = $this->userWithRole(RoleEnum::Bendahara->value);

        $this->actingAs($staff)->postJson('/api/v1/finance/cash', [
            'type' => 'income', 'category' => 'Uji', 'amount' => 10000,
            'transaction_at' => now()->toDateString(), 'bank_account_id' => '01tidakada',
        ])->assertStatus(422)->assertJsonPath('errors.code', 'VALIDATION');
    }

    public function test_guru_cannot_read_cash_report(): void
    {
        $guru = $this->userWithRole(RoleEnum::Guru->value);

        $this->actingAs($guru)->getJson('/api/v1/finance/reports/cash?from=2026-09-01&to=2026-09-02')
            ->assertForbidden();
    }
}
