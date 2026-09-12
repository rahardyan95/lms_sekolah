<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory, HasUlids;

    public const METHODS = ['tunai', 'transfer', 'virtual_account', 'qris'];

    protected $fillable = [
        'invoice_id', 'amount', 'method', 'reference',
        'receipt_number', 'recorded_by', 'paid_at', 'notes',
    ];

    protected $casts = ['amount' => 'integer', 'paid_at' => 'datetime'];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
