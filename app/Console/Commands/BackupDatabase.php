<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Backup Postgres via pg_dump -> storage/app/backups (volume storage_data),
 * kompres gzip + verifikasi integritas + offsite S3 opsional + pruning.
 * Dijadwalkan di bootstrap/app.php.
 */
class BackupDatabase extends Command
{
    protected $signature = 'db:backup {--keep=14 : jumlah file backup yang dipertahankan}';

    protected $description = 'Backup database Postgres (pg_dump | gzip) ke storage/app/backups';

    public function handle(): int
    {
        $dir = storage_path('app/backups');

        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $file = $dir.'/db-'.now()->format('Ymd-His').'.sql.gz';

        $conn = Config::get('database.connections.pgsql');
        if (! is_array($conn) || empty($conn['database'])) {
            $this->error('Koneksi pgsql tidak terkonfigurasi.');

            return self::FAILURE;
        }

        $parts = ['pg_dump', '--no-owner', '--no-acl'];

        if (! empty($conn['host'])) {
            $parts[] = '--host='.$conn['host'];
        }
        if (! empty($conn['port'])) {
            $parts[] = '--port='.$conn['port'];
        }
        if (! empty($conn['username'])) {
            $parts[] = '--username='.$conn['username'];
        }
        $parts[] = $conn['database'];

        $cmdline = implode(' ', array_map('escapeshellarg', $parts))
            .' | gzip > '.escapeshellarg($file);

        try {
            $process = Process::fromShellCommandline($cmdline, base_path(), [
                'PGPASSWORD' => (string) ($conn['password'] ?? ''),
            ], timeout: 600);

            $process->mustRun();

            $this->verify($file);
            $this->prune($dir, (int) $this->option('keep'));

            $size = file_exists($file) ? round(filesize($file) / 1024, 1).' KB' : '0 KB';
            $this->info("Backup selesai: {$file} ({$size})");

            return self::SUCCESS;
        } catch (Throwable $e) {
            @unlink($file);
            Log::error('db.backup.failed', ['error' => $e->getMessage()]);
            $this->error('Backup gagal: '.$e->getMessage());

            return self::FAILURE;
        }
    }

    private function verify(string $file): void
    {
        $check = Process::fromShellCommandline('gzip -t '.escapeshellarg($file), base_path(), timeout: 120);
        $check->mustRun();
    }

    private function prune(string $dir, int $keep): void
    {
        $files = glob($dir.'/db-*.sql.gz') ?: [];
        rsort($files);

        foreach (array_slice($files, max(1, $keep)) as $old) {
            @unlink($old);
        }
    }
}
