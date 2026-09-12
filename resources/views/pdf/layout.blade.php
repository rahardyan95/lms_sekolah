<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title ?? 'Dokumen' }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 12px; margin: 0; padding: 24px; }
        .doc-header { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
        .doc-header .school { font-size: 18px; font-weight: bold; color: #0f766e; }
        .doc-header .meta { color: #6b7280; font-size: 11px; margin-top: 4px; }
        .doc-title { text-align: center; font-size: 16px; font-weight: bold; margin: 16px 0 4px; letter-spacing: 1px; }
        .doc-subtitle { text-align: center; color: #6b7280; font-size: 11px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        table.kv td { padding: 6px 8px; vertical-align: top; }
        table.kv td.label { width: 38%; color: #6b7280; }
        table.data th, table.data td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
        table.data th { background: #f3f4f6; }
        .totals { margin-top: 16px; text-align: right; font-size: 13px; }
        .totals .grand { font-weight: bold; font-size: 15px; color: #0f766e; }
        .footer { position: fixed; bottom: 12px; left: 24px; right: 24px; color: #9ca3af; font-size: 10px; text-align: center; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; }
    </style>
</head>
<body>
    <div class="doc-header">
        <div class="school">{{ $schoolName ?? config('school.name') }}</div>
        <div class="meta">{{ $schoolAddress ?? '' }}@if(!empty($schoolPhone)) &middot; {{ $schoolPhone }}@endif</div>
    </div>

    @yield('content')

    <div class="footer">
        Dicetak {{ now()->translatedFormat('d F Y H:i') }} &middot; {{ $schoolName ?? config('school.name') }}
    </div>
</body>
</html>
