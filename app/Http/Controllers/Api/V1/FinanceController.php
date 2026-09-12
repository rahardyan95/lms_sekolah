<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\CashTransaction;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentItem;
use App\Models\Student;
use App\Services\FinanceService;
use App\Services\PdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FinanceController extends Controller
{
    public function __construct(protected FinanceService $service) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function items(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        return $this->envelope($request, PaymentItem::orderBy('name')->paginate(25));
    }

    public function storeItem(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'amount' => ['required', 'integer', 'min:0'],
            'academic_year' => ['nullable', 'string', 'max:16'],
            'active' => ['nullable', 'boolean'],
        ]);

        return $this->envelope($request, PaymentItem::create($data), 201);
    }

    public function distribute(Request $request, PaymentItem $item): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'student_ids' => ['sometimes', 'array', 'max:2000'],
            'student_ids.*' => ['string', 'exists:students,id'],
            'class_room_id' => ['sometimes', 'string', 'exists:class_rooms,id'],
            'period' => ['nullable', 'string', 'max:16'],
            'due_date' => ['nullable', 'date'],
        ]);

        $ids = $data['student_ids'] ?? [];
        if (empty($ids) && isset($data['class_room_id'])) {
            $ids = Student::where('class_room_id', $data['class_room_id'])->pluck('id')->all();
        }

        if (empty($ids)) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'VALIDATION', 'message' => 'student_ids atau class_room_id wajib diisi.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 422);
        }

        return $this->envelope(
            $request,
            $this->service->distribute($item, $ids, $data['period'] ?? null, $data['due_date'] ?? null),
            201
        );
    }

    public function invoices(Request $request): JsonResponse
    {
        $data = $request->validate([
            'student_id' => ['required', 'string', 'exists:students,id'],
            'status' => ['nullable', 'in:unpaid,partial,paid'],
        ]);

        $student = Student::findOrFail($data['student_id']);
        $this->authorize('viewStudentInvoices', $student);

        $invoices = Invoice::with('item')
            ->where('student_id', $student->id)
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderBy('due_date')->orderBy('created_at')
            ->paginate(50);

        return $this->envelope($request, $invoices);
    }

    public function pay(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', 'in:'.implode(',', Payment::METHODS)],
            'reference' => ['required', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $payment = $this->service->recordPayment(
            $invoice, $data['amount'], $data['method'], $data['reference'], $request->user(), $data['notes'] ?? null
        );

        return $this->envelope($request, $payment, 201);
    }

    public function receipt(Request $request, Payment $payment): JsonResponse
    {
        $this->authorize('viewInvoice', $payment->invoice);

        return $this->envelope($request, $payment->load('invoice.student', 'invoice.item', 'recorder'));
    }

    public function summary(Request $request, Student $student): JsonResponse
    {
        $this->authorize('viewStudentInvoices', $student);

        return $this->envelope($request, $this->service->studentSummary($student));
    }

    /** Kwitansi sebagai PDF aktual (jalur JSON di atas tetap untuk SPA). */
    public function receiptPdf(Request $request, Payment $payment, PdfService $pdf): Response
    {
        $this->authorize('viewInvoice', $payment->invoice);

        $payment->load('invoice.student', 'invoice.item');

        return $pdf->pdf('pdf.receipt', [
            'payment' => $payment,
            'student' => $payment->invoice->student,
            'invoice' => $payment->invoice,
            'itemName' => $payment->invoice->item?->name,
            'schoolName' => config('school.name'),
        ])->download("kwitansi-{$payment->receipt_number}.pdf");
    }

    // --- Rekening bank sekolah ---
    public function bankAccounts(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        return $this->envelope($request, BankAccount::orderBy('bank')->get());
    }

    public function storeBankAccount(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'bank' => ['required', 'string', 'max:64'],
            'account_number' => ['required', 'string', 'max:32'],
            'holder' => ['required', 'string', 'max:128'],
            'active' => ['nullable', 'boolean'],
        ]);

        $account = BankAccount::create([
            'bank' => $data['bank'],
            // Nomor lengkap terenkripsi di model; hanya versi mask yang tampil.
            'account_number' => $data['account_number'],
            'account_masked' => BankAccount::mask($data['account_number']),
            'holder' => $data['holder'],
            'active' => $data['active'] ?? true,
        ]);

        return $this->envelope($request, $account, 201);
    }

    // --- Arus kas ---
    public function cash(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'type' => ['nullable', 'in:'.implode(',', CashTransaction::TYPES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $rows = CashTransaction::query()
            ->when($data['type'] ?? null, fn ($q, $t) => $q->where('type', $t))
            ->when($data['from'] ?? null, fn ($q, $f) => $q->whereDate('transaction_at', '>=', $f))
            ->when($data['to'] ?? null, fn ($q, $t) => $q->whereDate('transaction_at', '<=', $t))
            ->orderByDesc('transaction_at')
            ->paginate(50);

        return $this->envelope($request, $rows);
    }

    public function storeCash(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', CashTransaction::TYPES)],
            'category' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'integer', 'min:1'],
            'transaction_at' => ['required', 'date'],
            'proof' => ['nullable', 'string', 'max:255'],
            'bank_account_id' => ['nullable', 'string', 'exists:bank_accounts,id'],
        ]);

        $transaction = $this->service->recordCash(
            $data['type'],
            $data['category'],
            (int) $data['amount'],
            $data['transaction_at'],
            $data['proof'] ?? null,
            $request->user(),
            $data['bank_account_id'] ?? null,
        );

        return $this->envelope($request, $transaction, 201);
    }

    /** Penyesuaian tagihan bertanda (koreksi, bukan sunting baris lama). */
    public function adjust(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'amount' => ['required', 'integer', 'not_in:0'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $payment = $this->service->adjustment(
            $invoice,
            (int) $data['amount'],
            $data['reason'],
            $request->user(),
        );

        return $this->envelope($request, $payment, 201);
    }

    public function cashReport(Request $request): JsonResponse
    {
        $this->authorize('manage', Invoice::class);

        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        return $this->envelope($request, $this->service->cashReport($data['from'], $data['to']));
    }
}
