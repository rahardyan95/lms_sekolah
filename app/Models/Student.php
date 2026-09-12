<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class Student extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'user_id', 'nisn', 'nik', 'name', 'gender',
        'birth_place', 'birth_date', 'photo_path',
        'class_room_id', 'status',
    ];

    protected $hidden = ['nik'];

    protected $casts = [
        'birth_date' => 'date',
        // NIK adalah PII — dienkripsi at rest (FRD: encrypted). Otomatis didekripsi
        // saat diakses; hidden agar tidak pernah ikut serialisasi API.
        'nik' => 'encrypted',
    ];

    /**
     * Foto sebagai data URI: DomPDF tidak dapat mengambil URL lokal/HTTP saat
     * merender kartu, jadi berkas dibaca langsung dari disk.
     */
    public function getPhotoDataUriAttribute(): ?string
    {
        $path = $this->photo_path;

        if (! $path || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        $mime = str_ends_with(strtolower($path), '.png') ? 'image/png' : 'image/jpeg';

        return 'data:'.$mime.';base64,'.base64_encode((string) Storage::disk('local')->get($path));
    }

    /** URL bertanda tangan (15 menit) untuk menampilkan foto di browser. */
    public function getPhotoUrlAttribute(): ?string
    {
        if (! $this->photo_path) {
            return null;
        }

        return URL::temporarySignedRoute('kts.photo', now()->addMinutes(15), ['student' => $this->id]);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function classRoom()
    {
        return $this->belongsTo(ClassRoom::class);
    }

    public function guardians()
    {
        return $this->belongsToMany(Guardian::class, 'guardian_student');
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }
}
