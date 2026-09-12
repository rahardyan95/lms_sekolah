@extends('pdf.layout')

@section('content')
    <div class="doc-title">BUKTI PENDAFTARAN SPMB</div>
    <div class="doc-subtitle">Tahun Pelajaran {{ now()->year }}/{{ now()->year + 1 }}</div>

    <table class="kv">
        <tr><td class="label">Nomor Pendaftaran</td><td><strong>{{ $application->registration_number }}</strong></td></tr>
        <tr><td class="label">Nama Lengkap</td><td>{{ $application->name }}</td></tr>
        <tr><td class="label">NISN</td><td>{{ $application->nisn }}</td></tr>
        <tr><td class="label">Jenis Kelamin</td><td>{{ $application->gender === 'L' ? 'Laki-laki' : ($application->gender === 'P' ? 'Perempuan' : '-') }}</td></tr>
        <tr><td class="label">Tempat / Tanggal Lahir</td><td>{{ $application->birth_place }}, {{ optional($application->birth_date)->translatedFormat('d F Y') }}</td></tr>
        <tr><td class="label">Asal Sekolah</td><td>{{ $application->previous_school }}</td></tr>
        <tr><td class="label">Pilihan Jurusan</td><td>{{ $application->chosen_major ?? '-' }}</td></tr>
        <tr><td class="label">Gelombang</td><td>{{ $application->wave->name ?? '-' }}</td></tr>
        <tr><td class="label">Status</td><td><span class="badge">{{ strtoupper((string) $application->status) }}</span></td></tr>
    </table>

    <p style="margin-top:24px;color:#6b7280;font-size:11px;">
        Simpan bukti ini sebagai tanda pendaftaran sah. Status dapat diperiksa kembali
        melalui halaman cek status SPMB menggunakan nomor pendaftaran dan tanggal lahir.
    </p>
@endsection
