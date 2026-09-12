<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['title', 'content', 'target_role', 'is_important', 'published', 'created_by'];

    protected $casts = ['is_important' => 'boolean', 'published' => 'boolean'];
}
