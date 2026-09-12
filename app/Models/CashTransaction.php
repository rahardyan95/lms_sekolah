<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Arus kas operasional: pemasukan (income) dan pengeluaran (expense). */
class CashTransaction extends Model
{
    use HasFactory, HasUlids;

    public const TYPE_INCOME = 'income';

    public const TYPE_EXPENSE = 'expense';

    public const TYPES = [self::TYPE_INCOME, self::TYPE_EXPENSE];

    protected $fillable = [
        'type', 'category', 'amount', 'transaction_at', 'proof', 'pic', 'recorded_by',
    ];

    protected $casts = ['amount' => 'integer', 'transaction_at' => 'datetime'];

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
