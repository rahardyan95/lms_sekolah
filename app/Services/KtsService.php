<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\KtsTemplate;
use App\Models\KtsToken;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * KTS QR signed: payload {nisn, jti, exp} + HMAC-SHA256 APP_KEY.
 * Verifikasi menolak token revoked/kedaluwarsa/tanda tangan salah
 * tanpa membocorkan data sensitif.
 */
class KtsService
{
    public const TTL_DAYS = 365;

    /** @return array{payload: string, signature: string, expires_at: string} */
    public function issue(Student $student): array
    {
        $token = $this->newToken($student);

        return $this->signedPayload($token) + ['token_id' => $token->id];
    }

    /** Daftar token QR siswa (untuk audit & pencabutan dari panel). */
    public function tokens(Student $student): Collection
    {
        return KtsToken::where('student_id', $student->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (KtsToken $token) => [
                'id' => $token->id,
                'jti' => $token->jti,
                'expires_at' => $token->expires_at->toIso8601String(),
                'revoked_at' => $token->revoked_at?->toIso8601String(),
                'valid' => $token->isValid(),
            ]);
    }

    /**
     * Token aktif untuk kartu: pakai ulang token valid terakhir agar setiap
     * preview/cetak tidak menumpuk baris token. Hanya terbitkan bila tidak ada.
     */
    public function activeToken(Student $student): KtsToken
    {
        $token = KtsToken::query()
            ->where('student_id', $student->id)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->latest('expires_at')
            ->first();

        return $token ?? $this->newToken($student);
    }

    /** @return array{payload: string, signature: string, expires_at: string} */
    public function signedPayload(KtsToken $token): array
    {
        $payload = base64_encode(json_encode([
            'nisn' => $token->student->nisn,
            'jti' => $token->jti,
            'exp' => $token->expires_at->timestamp,
        ]));

        return [
            'payload' => $payload,
            'signature' => $this->sign($payload),
            'expires_at' => $token->expires_at->toIso8601String(),
        ];
    }

    /**
     * String yang dicetak ke QR: membawa payload sekaligus tanda tangannya.
     * Pemindai tidak boleh mempercayai NISN mentah — verifikasi tetap di server.
     */
    public function qrString(Student $student): string
    {
        $signed = $this->signedPayload($this->activeToken($student));

        return 'KTS1|'.$signed['payload'].'|'.$signed['signature'];
    }

    /** @return array{valid: bool, nisn: string|null, reason: string} */
    public function verify(string $payload, string $signature): array
    {
        if (! hash_equals($this->sign($payload), $signature)) {
            return ['valid' => false, 'nisn' => null, 'reason' => 'INVALID_SIGNATURE'];
        }

        $data = json_decode((string) base64_decode($payload, true), true);

        if (! is_array($data) || empty($data['nisn']) || empty($data['jti'])) {
            return ['valid' => false, 'nisn' => null, 'reason' => 'MALFORMED'];
        }

        $token = KtsToken::where('jti', $data['jti'])->first();

        if (! $token || ! $token->isValid()) {
            return ['valid' => false, 'nisn' => null, 'reason' => 'REVOKED_OR_EXPIRED'];
        }

        return ['valid' => true, 'nisn' => $token->student->nisn, 'reason' => 'OK'];
    }

    public function revoke(KtsToken $token): void
    {
        $token->update(['revoked_at' => now()]);
    }

    /**
     * Simpan foto kartu siswa (mengganti berkas lama agar disk tidak menumpuk),
     * catat path di `students.photo_path`, dan tulis audit.
     */
    public function storePhoto(Student $student, UploadedFile $file): string
    {
        $previous = $student->photo_path;
        $path = $file->store('kts/photos', 'local');

        $student->update(['photo_path' => $path]);

        if ($previous && $previous !== $path) {
            Storage::disk('local')->delete($previous);
        }

        AuditLog::create([
            'actor_id' => request()->user()?->id,
            'actor_role' => request()->user()?->getRoleNames()->first(),
            'action' => 'KTS_PHOTO_UPLOADED',
            'entity' => 'students',
            'entity_id' => $student->id,
            'after' => ['photo_path' => $path],
            'ip_address' => request()->ip(),
            'request_id' => request()->header('X-Request-ID'),
        ]);

        return $path;
    }

    /**
     * Template aktif; bila belum ada, buat template default (GET pertama).
     * Lock cache membuat pembuatan serial sehingga dua request bersamaan
     * tidak menghasilkan dua baris aktif.
     */
    public function activeTemplate(): KtsTemplate
    {
        $existing = KtsTemplate::where('active', true)->latest('version')->first();

        if ($existing) {
            return $existing;
        }

        return Cache::lock('kts-template-default', 10)->block(
            5,
            fn () => KtsTemplate::where('active', true)->latest('version')->first()
                ?? KtsTemplate::create(KtsTemplate::defaults() + ['version' => 1, 'active' => true])
        );
    }

    /**
     * Simpan template baru: SELALU baris baru dengan version bertambah,
     * lalu tukar penanda aktif. Baris lama tetap utuh (riwayat immutable).
     *
     * @param  array{colors?: array<string, mixed>, visibility?: array<string, mixed>, watermark?: string|null}  $attrs
     */
    public function saveTemplate(array $attrs, User $actor): KtsTemplate
    {
        $current = $this->activeTemplate();
        $defaults = KtsTemplate::defaults();
        $colors = array_merge($defaults['colors'], (array) ($attrs['colors'] ?? $current->colors ?? []));
        $visibility = array_merge($defaults['visibility'], (array) ($attrs['visibility'] ?? $current->visibility ?? []));
        $watermark = array_key_exists('watermark', $attrs) ? $attrs['watermark'] : $current->watermark;

        return DB::transaction(function () use ($colors, $visibility, $watermark, $actor) {
            KtsTemplate::where('active', true)->update(['active' => false]);

            $template = KtsTemplate::create([
                'colors' => $colors,
                'visibility' => $visibility,
                'watermark' => $watermark,
                'version' => ((int) KtsTemplate::max('version')) + 1,
                'active' => true,
            ]);

            AuditLog::create([
                'actor_id' => $actor->id,
                'actor_role' => $actor->getRoleNames()->first(),
                'action' => 'KTS_TEMPLATE_SAVE',
                'entity' => 'kts_templates',
                'entity_id' => $template->id,
                'after' => ['version' => $template->version],
                'ip_address' => request()->ip(),
                'request_id' => request()->header('X-Request-ID'),
            ]);

            return $template;
        });
    }

    /**
     * Data lengkap untuk render kartu.
     *
     * @return array{student: Student, template: KtsTemplate, qr: string, masked_nik: string, signed: array<string, string>}
     */
    public function cardData(Student $student): array
    {
        $student->loadMissing('classRoom');
        $template = $this->activeTemplate();
        $signed = $this->signedPayload($this->activeToken($student));

        return [
            'student' => $student,
            'template' => $template,
            'qr' => 'KTS1|'.$signed['payload'].'|'.$signed['signature'],
            'masked_nik' => $this->maskNik($student->nik),
            'signed' => $signed,
        ];
    }

    /** NIK ditampilkan termask (FRD §7.1 + client.md group 2): **** + 4 digit terakhir. */
    public function maskNik(?string $nik): string
    {
        $digits = preg_replace('/\D/', '', (string) $nik) ?? '';

        return $digits === '' ? '****' : '****'.substr($digits, -4);
    }

    private function newToken(Student $student): KtsToken
    {
        return KtsToken::create([
            'student_id' => $student->id,
            'jti' => Str::random(16),
            'expires_at' => now()->addDays(self::TTL_DAYS),
        ]);
    }

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, (string) config('app.key'));
    }
}
