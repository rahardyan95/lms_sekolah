<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SchoolSetting extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['key', 'value', 'is_secret', 'version', 'updated_by'];

    protected $casts = ['is_secret' => 'boolean'];
}
