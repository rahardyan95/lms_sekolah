<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpmbFile extends Model
{
    use HasFactory, HasUlids;

    public const KINDS = ['kk', 'akta', 'rapor', 'foto', 'kip', 'lainnya'];

    public const MAX_BYTES = 2 * 1024 * 1024;

    protected $fillable = ['application_id', 'kind', 'path', 'original_name', 'mime', 'size'];

    protected $casts = ['size' => 'integer'];

    protected $hidden = ['path'];

    public function application(): BelongsTo
    {
        return $this->belongsTo(SpmbApplication::class, 'application_id');
    }
}
