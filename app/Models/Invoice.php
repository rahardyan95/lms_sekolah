<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory, HasUlids;

    public const STATUS_UNPAID = 'unpaid';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'student_id', 'item_id', 'title', 'period',
        'amount', 'paid_amount', 'status', 'due_date',
    ];

    protected $casts = [
        'amount' => 'integer',
        'paid_amount' => 'integer',
        'due_date' => 'date',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PaymentItem::class, 'item_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'invoice_id');
    }

    public function refreshStatus(): void
    {
        $this->status = $this->paid_amount >= $this->amount
            ? self::STATUS_PAID
            : ($this->paid_amount > 0 ? self::STATUS_PARTIAL : self::STATUS_UNPAID);
    }
}
