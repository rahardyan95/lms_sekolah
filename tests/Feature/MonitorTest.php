<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MonitorTest extends TestCase
{
    use RefreshDatabase;

    public function test_monitor_ok_on_healthy_system(): void
    {
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        touch($dir.'/db-'.now()->format('Ymd-His').'.sql.gz');

        $this->artisan('app:monitor')->assertSuccessful();
    }

    public function test_monitor_fails_without_backup(): void
    {
        foreach (glob(storage_path('app/backups/db-*.sql.gz')) ?: [] as $file) {
            @unlink($file);
        }

        $this->artisan('app:monitor')->assertFailed();
    }

    public function test_monitor_fails_on_failed_jobs(): void
    {
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        touch($dir.'/db-'.now()->format('Ymd-His').'.sql.gz');

        DB::table('failed_jobs')->insert([
            'uuid' => (string) str()->uuid(),
            'connection' => 'redis',
            'queue' => 'default',
            'payload' => '{}',
            'exception' => 'boom',
            'failed_at' => now(),
        ]);

        $this->artisan('app:monitor')->assertFailed();
    }
}
