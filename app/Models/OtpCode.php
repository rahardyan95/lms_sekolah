<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OtpCode extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['identifier', 'purpose', 'code_hash', 'expires_at', 'consumed_at', 'attempts'];

    protected $casts = ['expires_at' => 'datetime', 'consumed_at' => 'datetime'];
}
