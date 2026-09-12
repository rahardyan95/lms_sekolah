<?php

namespace Tests\Feature;

use App\Models\SchoolSetting;
use App\Services\WhatsappService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class WhatsappGatewayTest extends TestCase
{
    use RefreshDatabase;

    private const CONFIG = [
        'services.whatsapp.provider' => 'fonnte',
        'services.whatsapp.endpoint' => 'https://api.fonnte.com/send',
        'services.whatsapp.key' => 'wa-token-production-aman16',
    ];

    public function test_settings_panel_overrides_env_configuration(): void
    {
        config(self::CONFIG);
        SchoolSetting::create(['key' => 'wa_provider', 'value' => 'wablas']);
        SchoolSetting::create(['key' => 'wa_endpoint', 'value' => 'https://panel.wablas.com/send']);
        SchoolSetting::create(['key' => 'wa_api_key', 'value' => 'token-dari-panel']);
        Http::fake(['panel.wablas.com/*' => Http::response(['status' => 'success'], 200)]);
        Log::spy();

        $result = app(WhatsappService::class)->sendMessage('628123456789', 'halo');

        $this->assertSame('sent', $result['status']);
        $this->assertSame('wablas', $result['provider']);
        Http::assertSent(fn ($request) => $request->url() === 'https://panel.wablas.com/send'
            && $request->hasHeader('Authorization', 'token-dari-panel'));
    }

    public function test_send_failure_is_logged_not_swallowed(): void
    {
        config(self::CONFIG);
        Http::fake(['api.fonnte.com/*' => Http::response('forbidden', 500)]);
        Log::spy();

        $result = app(WhatsappService::class)->sendMessage('628123456789', 'halo');

        $this->assertSame('failed', $result['status']);
        Log::shouldHaveReceived('error')->once()->withArgs(
            fn (string $channel, array $context): bool => $channel === 'whatsapp.send-failed'
                && $context['to'] === '628123456789'
                && $context['status'] === 500
        );
    }

    public function test_send_success_does_not_log_error(): void
    {
        config(self::CONFIG);
        Http::fake(['api.fonnte.com/*' => Http::response(['status' => 'success'], 200)]);
        Log::spy();

        $result = app(WhatsappService::class)->sendMessage('628123456789', 'halo');

        $this->assertSame('sent', $result['status']);
        Log::shouldNotHaveReceived('error');
    }

    public function test_send_exception_is_logged_and_reported(): void
    {
        config(self::CONFIG);
        Http::fake(fn () => throw new ConnectionException('timeout'));
        Log::spy();

        $result = app(WhatsappService::class)->sendMessage('628123456789', 'halo');

        $this->assertSame('failed', $result['status']);
        $this->assertSame('ConnectionException: timeout', $result['error']);
        // report($e) ikut menulis log error internal — cukup pastikan log terstruktur kita terkirim.
        Log::shouldHaveReceived('error')->withArgs(
            fn (string $channel): bool => $channel === 'whatsapp.send-exception'
        );
    }

    public function test_log_provider_returns_sent_without_http(): void
    {
        config(['services.whatsapp.provider' => 'log']);
        Http::fake();
        Log::spy();

        $result = app(WhatsappService::class)->sendMessage('628123456789', 'halo');

        $this->assertSame(['status' => 'sent', 'provider' => 'log'], $result);
        Http::assertNothingSent();
    }
}
