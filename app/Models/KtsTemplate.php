<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Template KTS berversi. Menyimpan template menghasilkan baris BERISI BARU
 * (version bertambah) — baris lama tidak pernah diubah secara destruktif
 * sehingga cetak ulang kartu lama tetap reprodusibel (FRD §7.1).
 */
class KtsTemplate extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['colors', 'visibility', 'watermark', 'version', 'active'];

    protected $casts = [
        'colors' => 'array',
        'visibility' => 'array',
        'version' => 'integer',
        'active' => 'boolean',
    ];

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'colors' => ['header' => '#0f766e', 'background' => '#ffffff', 'text' => '#1f2937'],
            'visibility' => ['logo' => true, 'photo' => true, 'nisn' => true, 'nik' => true, 'name' => true, 'class' => true, 'major' => true, 'qr' => true],
            'watermark' => null,
        ];
    }
}
