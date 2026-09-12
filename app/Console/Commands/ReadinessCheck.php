<?php

namespace App\Console\Commands;

use App\Services\ProductionReadinessService;
use Illuminate\Console\Command;

/**
 * Gate go/no-go sebelum go-live: php artisan app:readiness
 * Exit 0 = siap, exit 1 = ada blocker (dipakai CI & runbook VPS).
 */
class ReadinessCheck extends Command
{
    protected $signature = 'app:readiness';

    protected $description = 'Cek kesiapan production (env, secret, session, queue, cors, mail, whatsapp)';

    public function handle(ProductionReadinessService $service): int
    {
        $report = $service->check();

        foreach ($report->checks as $check) {
            $icon = $check['ok'] ? '<info>PASS</info>' : '<error>FAIL</error>';
            $this->line(" [{$icon}] {$check['key']}: {$check['message']}");
        }

        foreach ($report->warnings as $warning) {
            $this->line(' [<comment>WARN</comment>] '.$warning);
        }

        $this->newLine();
        $warnCount = count($report->warnings);
        $this->info("Ringkasan: {$report->passed()} lolos, {$report->failed()} gagal, {$warnCount} peringatan.");

        if (! $report->isReady()) {
            $this->error('Belum siap go-live. Perbaiki FAIL di atas (lihat .env.prod.example + docs/DEPLOY.md).');

            return self::FAILURE;
        }

        $this->info('Siap go-live terbatas. Lanjut verifikasi: migrate, test, backup drill.');

        return self::SUCCESS;
    }
}
