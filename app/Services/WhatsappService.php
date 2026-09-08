<?php

namespace App\Services;

use App\Contracts\WhatsappGatewayInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsappService implements WhatsappGatewayInterface
{
    public function sendMessage(string $to, string $message): array
    {
        $provider = config('services.whatsapp.provider', 'log');
        $endpoint = config('services.whatsapp.endpoint');
        $apiKey = config('services.whatsapp.key');

        if ($provider === 'log' || ! $endpoint) {
            Log::info('whatsapp.mock-send', ['to' => $to]);
            return ['status' => 'sent', 'provider' => 'log'];
        }

        try {
            $response = Http::timeout(10)->withHeaders([
                'Authorization' => $apiKey,
            ])->post($endpoint, ['to' => $to, 'message' => $message]);

            return ['status' => $response->successful() ? 'sent' : 'failed', 'provider' => $provider];
        } catch (\Throwable $e) {
            return ['status' => 'failed', 'provider' => $provider, 'error' => $this->normalizeError($e)];
        }
    }

    public function checkHealth(): bool
    {
        $endpoint = config('services.whatsapp.endpoint');

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
}
