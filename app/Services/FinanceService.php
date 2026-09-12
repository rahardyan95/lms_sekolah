<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\CashTransaction;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Keuangan idempotent: distribusi tagihan anti-duplikat, pembayaran
 * transaksional dengan kwitansi unik, status konsisten.
 */
class FinanceService
{
    /** @return array{created: int, skipped: int} */
    public function distribute(PaymentItem $item, array $studentIds, ?string $period, ?string $dueDate): array
    {
        $created = 0;
        $skipped = 0;

        // SQL memperlakukan NULL != NULL, jadi unique(student,item,period) tidak
        // menahan duplikat periode kosong. Sentinel membuat index benar-benar bekerja.
        $period = $period ?: '-';

        foreach (array_unique($studentIds) as $studentId) {
            try {
                $invoice = Invoice::firstOrCreate(
                    ['student_id' => $studentId, 'item_id' => $item->id, 'period' => $period],
                    [
                        'title' => $item->name.($period !== '-' ? " — {$period}" : ''),
                        'amount' => $item->amount,
                        'paid_amount' => 0,
                        'status' => Invoice::STATUS_UNPAID,
                        'due_date' => $dueDate,
                    ]
                );
            } catch (UniqueConstraintViolationException) {
                // Dua distribusi bersamaan: yang kalah balapan tetap dihitung
                // skipped (tagihan sudah ada), bukan 500.
                $skipped++;

                continue;
            }

            $invoice->wasRecentlyCreated ? $created++ : $skipped++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    public function recordPayment(Invoice $invoice, int $amount, string $method, string $reference, User $recorder, ?string $notes = null): Payment
    {
        if ($amount <= 0) {
            throw new HttpException(422, 'Nominal pembayaran harus positif.');
        }

        return DB::transaction(function () use ($invoice, $amount, $method, $reference, $recorder, $notes) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if (Payment::where('reference', $reference)->exists()) {
                throw new HttpException(409, 'Referensi pembayaran sudah dipakai.');
            }

            if ($invoice->paid_amount + $amount > $invoice->amount) {
                throw new HttpException(422, 'Nominal melebihi sisa tagihan.');
            }

            try {
                $payment = $this->createPayment([
                    'invoice_id' => $invoice->id,
                    'amount' => $amount,
                    'method' => $method,
                    'reference' => $reference,
                    'recorded_by' => $recorder->id,
                    'paid_at' => now(),
                    'notes' => $notes,
                ]);
            } catch (UniqueConstraintViolationException $e) {
                // Reference sama dari dua request paralel: probe di atas lolos,
                // constraint yang menahan → jawab 409 sesuai kontrak.
                if (Payment::where('reference', $reference)->exists()) {
                    throw new HttpException(409, 'Referensi pembayaran sudah dipakai.');
                }

                throw $e;
            }

            $invoice->paid_amount += $amount;
            $invoice->refreshStatus();
            $invoice->save();

            return $payment->load('invoice');
        });
    }

    /** @return array{total_tagihan: int, total_dibayar: int, sisa: int, invoices: Collection} */
    public function studentSummary(Student $student): array
    {
        $invoices = $student->invoices()->with('item')->orderBy('due_date')->orderBy('created_at')->get();

        return [
            'total_tagihan' => (int) $invoices->sum('amount'),
            'total_dibayar' => (int) $invoices->sum('paid_amount'),
            'sisa' => (int) ($invoices->sum('amount') - $invoices->sum('paid_amount')),
            'invoices' => $invoices,
        ];
    }

    /**
     * Arus kas operasional. Nominal selalu positif; arah ditentukan `type`.
     */
    public function recordCash(string $type, string $category, int $amount, string $at, ?string $proof, User $pic, ?string $bankAccountId = null): CashTransaction
    {
        if (! in_array($type, CashTransaction::TYPES, true)) {
            throw new HttpException(422, 'Jenis transaksi kas tidak dikenal.');
        }

        if ($amount <= 0) {
            throw new HttpException(422, 'Nominal kas harus positif.');
        }

        return CashTransaction::create([
            'type' => $type,
            'bank_account_id' => $bankAccountId,
            'category' => $category,
            'amount' => $amount,
            'transaction_at' => $at,
            'proof' => $proof,
            'pic' => $pic->name,
            'recorded_by' => $pic->id,
        ]);
    }

    /**
     * Koreksi tagihan TANPA menyunting baris asli (FRD §12: reversal, bukan
     * silent edit). Nilai `delta` bertanda; baris penyesuaian dicatat sebagai
     * Payment baru sehingga jejak audit tetap utuh.
     */
    public function adjustment(Invoice $invoice, int $delta, string $reason, User $actor, string $referencePrefix = 'ADJ'): Payment
    {
        if ($delta === 0) {
            throw new HttpException(422, 'Nominal penyesuaian tidak boleh nol.');
        }

        return DB::transaction(function () use ($invoice, $delta, $reason, $actor, $referencePrefix) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            $nextPaid = $invoice->paid_amount + $delta;

            if ($nextPaid < 0 || $nextPaid > $invoice->amount) {
                throw new HttpException(422, 'Penyesuaian membuat pembayaran di luar rentang tagihan.');
            }

            $adjustment = $this->createPayment([
                'invoice_id' => $invoice->id,
                'amount' => $delta,
                'method' => 'tunai',
                'reference' => $referencePrefix.'-'.strtoupper(Str::random(10)),
                'recorded_by' => $actor->id,
                'paid_at' => now(),
                'notes' => $reason,
            ]);

            $invoice->paid_amount = $nextPaid;
            $invoice->refreshStatus();
            $invoice->save();

            AuditLog::create([
                'actor_id' => $actor->id,
                'actor_role' => $actor->getRoleNames()->first(),
                'action' => $referencePrefix === 'REV' ? 'FINANCE_REVERSAL' : 'FINANCE_ADJUSTMENT',
                'entity' => 'invoices',
                'entity_id' => $invoice->id,
                'after' => ['delta' => $delta, 'paid_amount' => $nextPaid, 'reason' => $reason],
                'ip_address' => request()->ip(),
                'request_id' => request()->header('X-Request-ID'),
            ]);

            return $adjustment->load('invoice');
        });
    }

    /** Pembalikan pembayaran: baris negatif baru, pembayaran asli tidak disentuh. */
    public function reversal(Payment $payment, User $actor, string $reason): Payment
    {
        if ($payment->amount <= 0) {
            throw new HttpException(422, 'Hanya baris pembayaran positif yang dapat dibalik.');
        }

        // Probe duplikat + penulisan baris REV dalam satu transaksi dengan lock
        // pada baris pembayaran asli: dua request paralel tidak bisa sama-sama
        // lolos probe lalu membalik dua kali (double refund).
        return DB::transaction(function () use ($payment, $actor, $reason) {
            $original = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

            $already = Payment::where('invoice_id', $original->invoice_id)
                ->where('notes', 'like', '%[REV '.$original->receipt_number.']%')
                ->exists();

            if ($already) {
                throw new HttpException(409, 'Pembayaran ini sudah dibalik.');
            }

            return $this->adjustment(
                $original->invoice,
                -1 * $original->amount,
                '[REV '.$original->receipt_number.'] '.$reason,
                $actor,
                'REV',
            );
        });
    }

    /**
     * Laporan arus kas: pemasukan = pembayaran bersih + kas income,
     * pengeluaran = kas expense. `opening` = saldo sebelum periode.
     *
     * @return array{from: string, to: string, income: int, expense: int, opening: int, closing: int}
     */
    public function cashReport(string $from, string $to): array
    {
        $start = $from.' 00:00:00';
        $end = $to.' 23:59:59';

        $income = (int) Payment::whereBetween('paid_at', [$start, $end])->sum('amount')
            + (int) CashTransaction::where('type', CashTransaction::TYPE_INCOME)
                ->whereBetween('transaction_at', [$start, $end])->sum('amount');
        $expense = (int) CashTransaction::where('type', CashTransaction::TYPE_EXPENSE)
            ->whereBetween('transaction_at', [$start, $end])->sum('amount');

        $openingIncome = (int) Payment::where('paid_at', '<', $start)->sum('amount')
            + (int) CashTransaction::where('type', CashTransaction::TYPE_INCOME)->where('transaction_at', '<', $start)->sum('amount');
        $openingExpense = (int) CashTransaction::where('type', CashTransaction::TYPE_EXPENSE)
            ->where('transaction_at', '<', $start)->sum('amount');

        $opening = $openingIncome - $openingExpense;

        // Pecahan per kanal dana (FRD §12): pembayaran tunai + kas tanpa rekening
        // = 'Kas Tunai'; sisanya melekat pada rekening masing-masing.
        $byAccount = [[
            'id' => null,
            'label' => 'Kas Tunai',
            ...$this->channelFigures(null, $start, $end),
        ]];

        foreach (BankAccount::query()->orderBy('bank')->get() as $account) {
            $byAccount[] = [
                'id' => $account->id,
                'label' => trim($account->bank.' '.$account->account_masked),
                ...$this->channelFigures($account->id, $start, $end),
            ];
        }

        return [
            'from' => $from,
            'to' => $to,
            'income' => $income,
            'expense' => $expense,
            'opening' => $opening,
            'closing' => $opening + $income - $expense,
            'by_account' => $byAccount,
        ];
    }

    /**
     * Angka satu kanal dana untuk periode + saldo awalnya.
     * `$accountId === null` berarti kas tunai (transaksi tanpa rekening,
     * dan pembayaran metode 'tunai').
     *
     * @return array{income: int, expense: int, opening: int, closing: int}
     */
    private function channelFigures(?string $accountId, string $start, string $end): array
    {
        $isCash = $accountId === null;

        $payments = fn () => Payment::query()
            ->when($isCash, fn ($q) => $q->where('method', 'tunai'), fn ($q) => $q->where('method', '!=', 'tunai'))
            ->when(! $isCash, fn ($q) => $q->whereNotNull('method'));

        $cash = fn () => CashTransaction::query()
            ->when($isCash, fn ($q) => $q->whereNull('bank_account_id'), fn ($q) => $q->where('bank_account_id', $accountId));

        $income = (int) $payments()->whereBetween('paid_at', [$start, $end])->sum('amount')
            + (int) $cash()->where('type', CashTransaction::TYPE_INCOME)->whereBetween('transaction_at', [$start, $end])->sum('amount');

        $expense = (int) $cash()->where('type', CashTransaction::TYPE_EXPENSE)
            ->whereBetween('transaction_at', [$start, $end])->sum('amount');

        $opening = (int) $payments()->where('paid_at', '<', $start)->sum('amount')
            + (int) $cash()->where('type', CashTransaction::TYPE_INCOME)->where('transaction_at', '<', $start)->sum('amount')
            - (int) $cash()->where('type', CashTransaction::TYPE_EXPENSE)->where('transaction_at', '<', $start)->sum('amount');

        return [
            'income' => $income,
            'expense' => $expense,
            'opening' => $opening,
            'closing' => $opening + $income - $expense,
        ];
    }

    /**
     * Probe ketersediaan nomor kwitansi di luar lock tidak cukup: dua transaksi
     * paralel bisa memilih nomor yang sama dan yang kalah kena unique violation.
     * Retry pada constraint-nya, bukan pada probe.
     */
    private function createPayment(array $attributes): Payment
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                return Payment::create($attributes + ['receipt_number' => $this->nextReceiptNumber()]);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt === 2) {
                    throw $e;
                }
            }
        }

        throw new \RuntimeException('Unreachable');
    }

    private function nextReceiptNumber(): string
    {
        return 'KW-'.now()->format('Ymd').'-'.strtoupper(Str::random(4));
    }
}
