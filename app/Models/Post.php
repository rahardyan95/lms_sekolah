<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;
use RuntimeException;

class Post extends Model
{
    use HasFactory, HasUlids;

    /** Alur status CMS: draft → review → published → archived. */
    public const STATUS_DRAFT = 'draft';

    public const STATUS_REVIEW = 'review';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    public const STATUSES = [
        self::STATUS_DRAFT, self::STATUS_REVIEW, self::STATUS_PUBLISHED, self::STATUS_ARCHIVED,
    ];

    protected $fillable = [
        'title', 'slug', 'category', 'excerpt', 'content',
        'image_url', 'tags', 'status', 'published_at', 'author_id',
    ];

    protected $casts = ['tags' => 'array', 'published_at' => 'datetime'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public static function slugify(string $title): string
    {
        $base = Str::slug($title) ?: 'berita';
        $slug = $base;
        $i = 2;

        while (static::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    /**
     * Slug unik tanpa celah balapan: probe exists() lalu insert tidak atomik,
     * jadi create diulang saat unique(slug) menolak, dengan slug dihitung ulang.
     */
    public static function createWithUniqueSlug(array $attributes): self
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                return static::create($attributes + ['slug' => static::slugify($attributes['title'])]);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt === 2) {
                    throw $e;
                }
            }
        }

        throw new RuntimeException('Unreachable');
    }
}
