<?php

namespace App\Services;

use App\Models\SchoolSetting;
use App\Models\User;

/**
 * Pengaturan sistem berversi: baca publik untuk non-secret,
 * tulis super-admin dengan optimistic locking + audit ringan.
 */
class SettingsService
{
    /**
     * Daftar putih kunci pengaturan. Kunci di luar daftar ditolak 422 agar
     * tabel settings tidak berubah jadi penyimpanan bebas.
     *
     * @var array<int, string>
     */
    public const ALLOWED_KEYS = [
        // Identitas sekolah
        'school_name', 'npsn', 'address', 'phone', 'email', 'logo_url', 'favicon_url',
        'school_wa_number',
        // WhatsApp gateway
        'wa_provider', 'wa_endpoint', 'wa_api_key', 'wa_sender',
        'wa_notify_attendance', 'wa_notify_otp',
        // SMTP
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from',
        // Sakelar & kebijakan
        'spmb_open', 'spmb_test_mode', 'retention_months', 'timezone', 'late_after',
        // Profil publik (CMS)
        'school_profile', 'school_history', 'headmaster_greeting',
        'school_agenda', 'maps_embed', 'social_links',
    ];

    /** @return array<string, mixed> */
    public function all(bool $withSecrets): array
    {
        // Dibaca lewat model, bukan pluck: cast `encrypted` tidak jalan pada
        // query builder sehingga pluck('value') akan mengembalikan ciphertext.
        return SchoolSetting::query()
            ->when(! $withSecrets, fn ($q) => $q->where('is_secret', false))
            ->get()
            ->mapWithKeys(fn (SchoolSetting $s) => [$s->key => $s->value])
            ->all();
    }

    /** Baca satu kunci (lewat model agar cast `encrypted` diterapkan). */
    public function value(string $key, mixed $default = null): mixed
    {
        return SchoolSetting::where('key', $key)->first()?->value ?? $default;
    }

    /** Sakelar boolean disimpan sebagai string '1'/'0'/'true'/'false'. */
    public function flag(string $key, bool $default = false): bool
    {
        $raw = $this->value($key);

        if ($raw === null) {
            return $default;
        }

        return filter_var($raw, FILTER_VALIDATE_BOOLEAN);
    }

    public function set(string $key, mixed $value, User $updater, ?int $expectedVersion = null): SchoolSetting
    {
        if (! in_array($key, self::ALLOWED_KEYS, true)) {
            abort(response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'SETTING_KEY_NOT_ALLOWED', 'message' => 'Key tidak diizinkan.'],
                'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
            ], 422));
        }

        $setting = SchoolSetting::firstOrCreate(
            ['key' => $key],
            ['value' => null, 'is_secret' => str_contains(strtolower($key), 'secret') || str_contains(strtolower($key), 'key')]
        );
        $setting->refresh();

        if ($expectedVersion !== null && $setting->version !== $expectedVersion) {
            abort(409, 'Pengaturan berubah oleh admin lain, muat ulang dulu.');
        }

        $setting->update([
            'value' => is_scalar($value) ? (string) $value : json_encode($value),
            'version' => $setting->version + 1,
            'updated_by' => $updater->id,
        ]);

        return $setting->refresh();
    }
}
