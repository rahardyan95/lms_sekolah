<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Monitor kesehatan terjadwal: job gagal, umur backup terakhir,
 * konektivitas Redis. Gagal (exit 1) + report() ke Sentry bila ada temuan.
 */
class MonitorHealth extends Command
{
    protected $signature = 'app:monitor {--max-backup-hours=26 : umur maksimum backup terakhir}';

    protected $description = 'Cek job gagal, backup terakhir, dan konektivitas Redis';

    public function handle(): int
    {
        $problems = [];

        $failed = DB::table('failed_jobs')->count();
        if ($failed > 0) {
            $problems[] = "failed_jobs={$failed}";
        }

        $files = glob(storage_path('app/backups/db-*.sql.gz')) ?: [];
        if ($files === []) {
            $problems[] = 'backup tidak ditemukan';
        } else {
            rsort($files);
            $ageHours = (time() - (int) filemtime($files[0])) / 3600;
            if ($ageHours > (int) $this->option('max-backup-hours')) {
                $problems[] = sprintf('backup terakhir %.1f jam lalu', $ageHours);
            }
        }

        try {
            app('redis')->ping();
        } catch (Throwable $e) {
            $problems[] = 'redis tidak terjangkau';
        }

        if ($problems === []) {
            $this->info('Monitor OK: queue, backup, redis sehat.');

            return self::SUCCESS;
        }

        $message = 'Monitor bermasalah: '.implode('; ', $problems);
        Log::error('app.monitor.failed', ['problems' => $problems]);
        report(new \RuntimeException($message));
        $this->error($message);

        return self::FAILURE;
    }
}
