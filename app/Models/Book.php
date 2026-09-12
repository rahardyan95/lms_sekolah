<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Book extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'title', 'author', 'publisher', 'isbn', 'year',
        'category', 'physical_stock', 'ebook_path', 'page_count', 'summary',
    ];

    protected $casts = ['year' => 'integer', 'physical_stock' => 'integer', 'page_count' => 'integer'];

    protected $hidden = ['ebook_path'];

    protected $appends = ['has_ebook', 'available'];

    public function getHasEbookAttribute(): bool
    {
        return $this->ebook_path !== null;
    }

    public function getAvailableAttribute(): int
    {
        return $this->availableStock();
    }

    public function loans(): HasMany
    {
        return $this->hasMany(BookLoan::class, 'book_id');
    }

    public function availableStock(): int
    {
        // borrowed_count (withCount) dipakai lebih dulu agar katalog tidak
        // memicu satu query per buku (N+1).
        $borrowed = $this->borrowed_count ?? $this->loans()->where('status', 'borrowed')->count();

        return max(0, $this->physical_stock - $borrowed);
    }
}
