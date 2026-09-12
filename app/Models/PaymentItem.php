<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentItem extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['name', 'category', 'amount', 'academic_year', 'active'];

    protected $casts = ['amount' => 'integer', 'active' => 'boolean'];

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'item_id');
    }
}
