@php
    $header = $template->colors['header'] ?? '#0f766e';
    $body = $template->colors['background'] ?? '#ffffff';
    $visible = $template->visibility ?? [];
    $show = fn (string $key) => ($visible[$key] ?? true) !== false;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>KTS {{ $student->nisn }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; margin: 0; padding: 24px; }
        .card {
            width: 85.6mm; height: 54mm; border: 1px solid #cbd5e1;
            border-radius: 3mm; overflow: hidden; background: {{ $body }};
        }
        .card-header {
            background: {{ $header }}; color: #ffffff; padding: 3mm 4mm;
            font-size: 9pt; font-weight: bold;
        }
        .card-header .sub { font-size: 7pt; font-weight: normal; opacity: 0.9; }
        .card-body { display: table; width: 100%; padding: 2mm 4mm; }
        .col { display: table-cell; vertical-align: top; }
        .photo { width: 22mm; height: 30mm; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: center; }
        .fields { padding-left: 4mm; font-size: 8pt; }
        .fields .row { margin-bottom: 1.2mm; }
        .fields .k { color: #64748b; font-size: 6.5pt; text-transform: uppercase; }
        .fields .v { font-weight: bold; }
        .qr { text-align: right; }
        .watermark { position: absolute; opacity: 0.08; font-size: 40pt; font-weight: bold; }
        .empty-avatar { color: #94a3b8; font-size: 7pt; padding-top: 12mm; }
    </style>
</head>
<body>
    <div class="card">
        <div class="card-header">
            {{ $schoolName ?? config('school.name') }}
            <div class="sub">KARTU TANDA PELAJAR</div>
        </div>
        <div class="card-body">
            <div class="col" style="width: 24mm;">
                <div class="photo">
                    @if(!empty($student->photo_url))
                        <img src="{{ $student->photo_url }}" style="width:22mm;height:30mm;">
                    @else
                        <div class="empty-avatar">FOTO</div>
                    @endif
                </div>
            </div>
            <div class="col fields">
                @if($show('name'))
                    <div class="row"><div class="k">Nama</div><div class="v">{{ $student->name }}</div></div>
                @endif
                @if($show('nisn'))
                    <div class="row"><div class="k">NISN</div><div class="v">{{ $student->nisn }}</div></div>
                @endif
                @if($show('nik'))
                    <div class="row"><div class="k">NIK</div><div class="v">{{ $maskedNik }}</div></div>
                @endif
                @if($show('class'))
                    <div class="row"><div class="k">Kelas</div><div class="v">{{ $student->classRoom->name ?? '-' }}</div></div>
                @endif
                @if($show('major') && !empty($student->classRoom?->major))
                    <div class="row"><div class="k">Jurusan</div><div class="v">{{ $student->classRoom->major }}</div></div>
                @endif
            </div>
            <div class="col qr" style="width: 22mm;">
                @if($show('qr'))
                    {!! $qrSvg !!}
                @endif
            </div>
        </div>
        @if(!empty($template->watermark))
            <div class="watermark">{{ $template->watermark }}</div>
        @endif
    </div>
</body>
</html>
