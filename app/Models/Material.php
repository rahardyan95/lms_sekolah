<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Material extends Model
{
    use HasFactory, HasUlids;

    public const FILE_TYPES = ['PDF', 'PPT', 'DOC', 'VIDEO'];

    protected $fillable = [
        'subject_id', 'title', 'description', 'file_type',
        'path', 'original_name', 'size', 'kelas', 'author_id',
    ];

    protected $casts = ['size' => 'integer'];

    protected $hidden = ['path'];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
