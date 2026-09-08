<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $fillable = [
        'actor_id', 'actor_role', 'action', 'entity',
        'entity_id', 'before', 'after', 'ip_address', 'request_id',
    ];

    protected $casts = ['before' => 'array', 'after' => 'array', 'created_at' => 'datetime'];
}
