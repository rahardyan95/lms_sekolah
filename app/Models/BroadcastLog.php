<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BroadcastLog extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['broadcast_id', 'recipient_name', 'recipient_phone', 'status', 'provider_response'];

    protected $hidden = ['recipient_phone'];

    protected $casts = ['recipient_phone' => 'encrypted'];

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(Broadcast::class, 'broadcast_id');
    }
}
