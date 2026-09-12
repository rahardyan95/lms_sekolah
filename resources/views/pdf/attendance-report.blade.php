@extends('pdf.layout')

@section('content')
    <div class="doc-title">LAPORAN PRESENSI</div>
    <div class="doc-subtitle">Periode {{ $from }} s/d {{ $to }}@if(!empty($classRoom)) &middot; Kelas {{ $classRoom }}@endif</div>

    <table class="data">
        <thead>
            <tr>
                <th style="width:6%;">#</th>
                <th>NISN</th>
                <th>Nama</th>
                <th style="text-align:center;">Hadir</th>
                <th style="text-align:center;">Terlambat</th>
                <th style="text-align:center;">Sakit</th>
                <th style="text-align:center;">Izin</th>
                <th style="text-align:center;">Alpa</th>
                <th style="text-align:center;">%</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $i => $row)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $row['nisn'] }}</td>
                    <td>{{ $row['name'] }}</td>
                    <td style="text-align:center;">{{ $row['hadir'] }}</td>
                    <td style="text-align:center;">{{ $row['terlambat'] }}</td>
                    <td style="text-align:center;">{{ $row['sakit'] }}</td>
                    <td style="text-align:center;">{{ $row['izin'] }}</td>
                    <td style="text-align:center;">{{ $row['alpa'] }}</td>
                    <td style="text-align:center;">{{ $row['percentage'] }}%</td>
                </tr>
            @empty
                <tr><td colspan="9" style="text-align:center;color:#9ca3af;">Tidak ada data pada periode ini.</td></tr>
            @endforelse
        </tbody>
    </table>
@endsection
