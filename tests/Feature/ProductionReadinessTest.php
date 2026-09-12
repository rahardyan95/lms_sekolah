<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ProductionReadinessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_wa_checks_fail_when_provider_log(): void
    {
        config([
            'services.whatsapp.provider' => 'log',
            'services.whatsapp.endpoint' => null,
            'services.whatsapp.key' => null,
        ]);

        $report = app(ProductionReadinessService::class)->check();
        $status = collect($report->checks)->pluck('ok', 'key');

        $this->assertFalse($status['wa.provider']);
        $this->assertFalse($status['wa.endpoint']);
        $this->assertFalse($status['wa.key']);
    }

    public function test_wa_checks_pass_when_provider_configured(): void
    {
        config([
            'services.whatsapp.provider' => 'fonnte',
            'services.whatsapp.endpoint' => 'https://api.fonnte.com/send',
            'services.whatsapp.key' => 'wa-token-production-aman16',
        ]);

        $report = app(ProductionReadinessService::class)->check();
        $status = collect($report->checks)->pluck('ok', 'key');

        $this->assertTrue($status['wa.provider']);
        $this->assertTrue($status['wa.endpoint']);
        $this->assertTrue($status['wa.key']);
    }

    public function test_wa_endpoint_check_fails_on_plain_http(): void
    {
        config([
            'services.whatsapp.provider' => 'custom',
            'services.whatsapp.endpoint' => 'http://gateway.local/send',
            'services.whatsapp.key' => 'wa-token-production-aman16',
        ]);

        $report = app(ProductionReadinessService::class)->check();
        $status = collect($report->checks)->pluck('ok', 'key');

        $this->assertTrue($status['wa.provider']);
        $this->assertFalse($status['wa.endpoint']);
    }

    public function test_warning_when_users_table_empty(): void
    {
        $report = app(ProductionReadinessService::class)->check();

        $this->assertNotEmpty($report->warnings);
        $this->assertStringContainsString('admin:create', $report->warnings[0]);
    }

    public function test_no_user_warning_when_users_exist(): void
    {
        User::factory()->create();
        config(['services.backup.bucket' => 'lms-sekolah-backups']);

        $report = app(ProductionReadinessService::class)->check();

        $this->assertSame([], $report->warnings);
    }

    public function test_warning_when_offsite_backup_bucket_missing(): void
    {
        User::factory()->create();
        config(['services.backup.bucket' => null]);

        $report = app(ProductionReadinessService::class)->check();

        $this->assertCount(1, $report->warnings);
        $this->assertStringContainsString('BACKUP_S3_BUCKET', $report->warnings[0]);
    }
}
