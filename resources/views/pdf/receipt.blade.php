@extends('pdf.layout')

@section('content')
    <div class="doc-title">KWITANSI PEMBAYARAN</div>
    <div class="doc-subtitle">No. {{ $payment->receipt_number }}</div>

    <table class="kv">
        <tr>
            <td class="label">Telah diterima dari</td>
            <td><strong>{{ $student->name ?? '-' }}</strong> ({{ $student->nisn ?? '-' }})</td>
        </tr>
        <tr>
            <td class="label">Untuk pembayaran</td>
            <td>{{ $invoice->title ?? $itemName ?? 'Pembayaran sekolah' }}</td>
        </tr>
        <tr>
            <td class="label">Tanggal</td>
            <td>{{ \Illuminate\Support\Carbon::parse($payment->paid_at ?? $payment->created_at)->translatedFormat('d F Y') }}</td>
        </tr>
        <tr>
            <td class="label">Metode</td>
            <td>{{ strtoupper((string) $payment->method) }}</td>
        </tr>
        <tr>
            <td class="label">Status</td>
            <td><span class="badge">{{ strtoupper((string) $payment->status) }}</span></td>
        </tr>
    </table>

    <div class="totals">
        <div>Jumlah dibayar</div>
        <div class="grand">Rp {{ number_format((int) $payment->amount, 0, ',', '.') }}</div>
    </div>
@endsection
