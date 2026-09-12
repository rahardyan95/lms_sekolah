<?php

namespace App\Services;

use App\Models\User;

/**
 * Single-responsibility service untuk go/no-go check sebelum go-live.
 * Dipakai artisan app:readiness + bisa dipakai health endpoint internal.
 * Aturan diselaraskan dengan .env.prod.example + PRD NFR-006/007/013/015.
 */
class ProductionReadinessService
{
    private const WEAK_PASSWORDS = ['secret', 'password', 'password123', 'changeme', 'admin'];

    private const DEFAULT_MEILI_KEYS = ['meiliMasterKey123', 'masterKey', 'changeme'];

    public function check(): ProductionReadinessReport
    {
        $checks = [
            $this->item('app.env', app()->environment('production'), 'APP_ENV harus production saat go-live.'),
            $this->item('app.debug', config('app.debug') === false, 'APP_DEBUG harus false di production.'),
            $this->item('app.key', $this->hasValidAppKey(), 'APP_KEY harus terisi & valid (php artisan key:generate --show).'),
            $this->item('app.url', str_starts_with((string) config('app.url'), 'https://'), 'APP_URL harus https:// (TLS via reverse proxy).'),
            $this->item('db.password', $this->isStrongSecret((string) config('database.connections.pgsql.password')), 'DB_PASSWORD wajib kuat (≥16 char, bukan default).'),
            $this->item('redis.password', $this->isStrongSecret((string) config('database.redis.default.password')), 'REDIS_PASSWORD wajib diisi (mengaktifkan requirepass).'),
            $this->item('meili.key', $this->isStrongSecret((string) config('services.meilisearch.key')), 'MEILI_MASTER_KEY wajib diganti dari default.'),
            $this->item('sanctum.expiry', $this->hasSanctumExpiry(), 'SANCTUM_TOKEN_EXPIRATION wajib diisi (menit, mis. 120).'),
            $this->item('cors.origins', $this->hasProdCors(), 'CORS_ALLOWED_ORIGINS harus domain https produksi, tanpa localhost.'),
            $this->item('mail.host', (string) config('mail.mailers.smtp.host') !== 'mailpit', 'MAIL_HOST jangan mailpit di production (gunakan SMTP asli).'),
            $this->item('wa.provider', $this->hasRealWaProvider(), 'WA_PROVIDER wajib provider nyata (fonnte/wablas/custom) — OTP login orang tua dikirim via WhatsApp.'),
            $this->item('wa.endpoint', $this->hasValidWaEndpoint(), 'WA_ENDPOINT wajib URL https gateway WhatsApp.'),
            $this->item('wa.key', $this->isStrongSecret((string) config('services.whatsapp.key')), 'WA_API_KEY wajib diisi (token provider gateway).'),
            $this->item('session.secure', config('session.secure') === true, 'SESSION_SECURE_COOKIE harus true di production.'),
            $this->item('queue.connection', config('queue.default') === 'redis', 'QUEUE_CONNECTION=redis agar notifikasi & job jalan via worker.'),
            $this->item('cache.store', config('cache.default') === 'redis', 'CACHE_STORE=redis untuk konsistensi antar container.'),
        ];

        return new ProductionReadinessReport($checks, $this->collectWarnings());
    }

    /** @return array{key: string, ok: bool, message: string} */
    private function item(string $key, bool $ok, string $message): array
    {
        return ['key' => $key, 'ok' => $ok, 'message' => $message];
    }

    private function hasValidAppKey(): bool
    {
        $key = (string) config('app.key', '');

        return str_starts_with($key, 'base64:') && strlen($key) >= 40;
    }

    private function isStrongSecret(string $secret): bool
    {
        $trimmed = trim($secret);

        if (strlen($trimmed) < 16) {
            return false;
        }

        foreach (self::WEAK_PASSWORDS as $weak) {
            if (strtolower($trimmed) === strtolower($weak)) {
                return false;
            }
        }

        foreach (self::DEFAULT_MEILI_KEYS as $weak) {
            if ($trimmed === $weak) {
                return false;
            }
        }

        return true;
    }

    private function hasSanctumExpiry(): bool
    {
        $minutes = config('sanctum.expiration');

        return is_numeric($minutes) && (int) $minutes > 0;
    }

    private function hasProdCors(): bool
    {
        $raw = (string) env('CORS_ALLOWED_ORIGINS', '');
        $origins = array_values(array_filter(array_map('trim', explode(',', $raw))));

        if ($origins === []) {
            return false;
        }

        foreach ($origins as $origin) {
            if (! str_starts_with($origin, 'https://')) {
                return false;
            }
            if (str_contains($origin, 'localhost') || str_contains($origin, '127.0.0.1')) {
                return false;
            }
        }

        return true;
    }

    private function hasRealWaProvider(): bool
    {
        $provider = strtolower(trim((string) config('services.whatsapp.provider', 'log')));

        return $provider !== '' && $provider !== 'log';
    }

    private function hasValidWaEndpoint(): bool
    {
        return str_starts_with((string) config('services.whatsapp.endpoint', ''), 'https://');
    }

    /**
     * Peringatan non-blocking (tidak menggagalkan go/no-go).
     *
     * @return array<int, string>
     */
    private function collectWarnings(): array
    {
        $warnings = [];

        if ($this->isUsersTableEmpty()) {
            $warnings[] = 'users kosong — bootstrap admin pertama via php artisan admin:create sebelum go-live.';
        }

        if (trim((string) config('services.backup.bucket')) === '') {
            $warnings[] = 'BACKUP_S3_BUCKET kosong — backup offsite tidak jalan (RPO hanya lokal 2 hari). Isi bucket + jalankan scripts/backup.sh.';
        }

        return $warnings;
    }

    private function isUsersTableEmpty(): bool
    {
        try {
            return User::query()->count() === 0;
        } catch (\Throwable) {
            // Tabel belum ada (mis. readiness dijalankan sebelum migrate pertama) — bukan warning.
            return false;
        }
    }
}
