<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Broadcast extends Model
{
    use HasFactory, HasUlids;

    public const AUDIENCES = ['siswa', 'orang_tua', 'guru', 'semua'];

    protected $fillable = ['title', 'body', 'audience', 'status', 'created_by'];

    public function logs(): HasMany
    {
        return $this->hasMany(BroadcastLog::class, 'broadcast_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
