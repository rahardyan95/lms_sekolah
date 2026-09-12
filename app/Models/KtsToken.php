<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KtsToken extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['student_id', 'jti', 'expires_at', 'revoked_at'];

    protected $casts = ['expires_at' => 'datetime', 'revoked_at' => 'datetime'];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function isValid(): bool
    {
        return $this->revoked_at === null && now()->lessThanOrEqualTo($this->expires_at);
    }
}
