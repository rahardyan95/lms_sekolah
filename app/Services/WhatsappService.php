<?php

namespace App\Services;

use App\Contracts\WhatsappGatewayInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsappService implements WhatsappGatewayInterface
{
    public function __construct(protected SettingsService $settings) {}

    /** @var array{provider: string, endpoint: mixed, key: mixed}|null */
    private ?array $primary = null;

    /**
     * Resolusi kredensial utama sekali per instance: satu job broadcast bisa
     * memanggil sendMessage ribuan kali — tanpa memo, tiap penerima menambah
     * 3 query settings.
     *
     * @return array{provider: string, endpoint: mixed, key: mixed}
     */
    private function primary(): array
    {
        return $this->primary ??= [
            'provider' => (string) $this->setting('wa_provider', config('services.whatsapp.provider', 'log')),
            'endpoint' => $this->setting('wa_endpoint', config('services.whatsapp.endpoint')),
            'key' => $this->setting('wa_api_key', config('services.whatsapp.key')),
        ];
    }

    /**
     * Panel Pengaturan menyimpan gateway di `school_settings`; runtime memakai
     * nilai itu lebih dulu dan env hanya fallback — tanpa ini admin bisa
     * "menyimpan" endpoint/API key tanpa efek apa pun (misconfig senyap).
     */
    private function setting(string $key, mixed $fallback): mixed
    {
        $value = $this->settings->value($key);

        return ($value === null || $value === '') ? $fallback : $value;
    }

    public function sendMessage(string $to, string $message): array
    {
        $credentials = $this->primary();

        return $this->dispatch(
            $credentials['provider'],
            $credentials['endpoint'],
            $credentials['key'],
            $to,
            $message,
        );
    }

    /**
     * Kirim dengan penyedia cadangan (DEC-001: Fonnte → Wablas). Percobaan
     * utama dijalankan lebih dulu; bila tidak terkirim dan fallback
     * dikonfigurasi, pesan diulang lewat fallback. `sendMessage` menelan
     * exception menjadi status 'failed', jadi pemicu fallback = status.
     *
     * @return array{provider: string|null, ok: bool, error: string|null, primary: array<string, mixed>}
     */
    public function sendWithFallback(string $to, string $message): array
    {
        $primary = $this->sendMessage($to, $message);

        if (($primary['status'] ?? 'failed') === 'sent') {
            return [
                'provider' => $primary['provider'] ?? null,
                'ok' => true,
                'error' => null,
                'primary' => $primary,
            ];
        }

        $fallbackProvider = (string) config('services.whatsapp.fallback_provider', '');

        if ($fallbackProvider === '') {
            return [
                'provider' => $primary['provider'] ?? null,
                'ok' => false,
                'error' => $primary['error'] ?? null,
                'primary' => $primary,
            ];
        }

        $fallback = $this->dispatch(
            $fallbackProvider,
            config('services.whatsapp.fallback_endpoint') ?: $this->setting('wa_endpoint', config('services.whatsapp.endpoint')),
            config('services.whatsapp.fallback_key') ?: $this->setting('wa_api_key', config('services.whatsapp.key')),
            $to,
            $message,
        );

        return [
            'provider' => $fallbackProvider,
            'ok' => ($fallback['status'] ?? 'failed') === 'sent',
            'error' => $fallback['error'] ?? null,
            'primary' => $primary,
        ];
    }

    public function checkHealth(): bool
    {
        $endpoint = $this->primary()['endpoint'];

        if (! $endpoint) {
            return true;
        }

        try {
            return Http::timeout(5)->get($endpoint)->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    public function normalizeError(\Throwable $e): string
    {
        return class_basename($e).': '.$e->getMessage();
    }

    /** @return array<string, mixed> */
    private function dispatch(string $provider, ?string $endpoint, ?string $apiKey, string $to, string $message): array
    {
        if ($provider === 'log' || ! $endpoint) {
            Log::info('whatsapp.mock-send', ['to' => $to, 'provider' => $provider]);

            return ['status' => 'sent', 'provider' => $provider];
        }

        try {
            $response = Http::timeout(10)->withHeaders([
                'Authorization' => $apiKey,
            ])->post($endpoint, ['to' => $to, 'message' => $message]);

            if (! $response->successful()) {
                Log::error('whatsapp.send-failed', [
                    'provider' => $provider,
                    'to' => $to,
                    'status' => $response->status(),
                    'body' => substr((string) $response->body(), 0, 200),
                ]);
            }

            return ['status' => $response->successful() ? 'sent' : 'failed', 'provider' => $provider];
        } catch (\Throwable $e) {
            Log::error('whatsapp.send-exception', [
                'provider' => $provider,
                'to' => $to,
                'error' => $this->normalizeError($e),
            ]);
            report($e);

            return ['status' => 'failed', 'provider' => $provider, 'error' => $this->normalizeError($e)];
        }
    }
}
