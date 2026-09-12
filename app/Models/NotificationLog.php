<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Jejak pengiriman notifikasi (WA/SMTP). Satu baris per percobaan job;
 * status: pending → processing → sent|failed.
 */
class NotificationLog extends Model
{
    use HasFactory, HasUlids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'channel', 'recipient', 'template', 'status',
        'provider_ref', 'attempts', 'last_error',
    ];

    protected $casts = ['attempts' => 'integer'];
}
