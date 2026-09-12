<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpmbWave extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['name', 'start_date', 'end_date', 'quota', 'fee', 'active'];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'quota' => 'integer',
        'fee' => 'integer',
        'active' => 'boolean',
    ];

    public function applications(): HasMany
    {
        return $this->hasMany(SpmbApplication::class, 'wave_id');
    }

    public function isOpen(): bool
    {
        if (! $this->active) {
            return false;
        }

        $today = now(config('school.timezone', 'Asia/Jakarta'))->format('Y-m-d');

        return $today >= $this->start_date->format('Y-m-d')
            && $today <= $this->end_date->format('Y-m-d');
    }

    public function filledCount(): int
    {
        return $this->applications()->whereIn('status', ['verified', 'accepted'])->count();
    }
}
