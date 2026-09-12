<?php

namespace App\Console\Commands;

use App\Models\CbtAttempt;
use App\Services\CbtService;
use Illuminate\Console\Command;

/**
 * Auto-submit percobaan CBT yang melewati deadline tanpa menekan kirim.
 * Grading di service idempotent, jadi command aman dijalankan tiap menit
 * (attempt yang sudah dikumpulkan tidak dihitung ulang).
 */
class AutoSubmitCbtAttempts extends Command
{
    protected $signature = 'cbt:auto-submit';

    protected $description = 'Kumpulkan otomatis attempt CBT yang sudah melewati deadline';

    public function handle(CbtService $service): int
    {
        $submitted = 0;

        CbtAttempt::query()
            ->whereNull('submitted_at')
            ->where('deadline_at', '<', now())
            ->orderBy('deadline_at')
            ->chunkById(100, function ($attempts) use ($service, &$submitted) {
                foreach ($attempts as $attempt) {
                    $result = $service->autoSubmitAttempt($attempt->load('exam.questions'));
                    $submitted++;
                    $this->line("Attempt {$attempt->id} dikumpulkan otomatis — skor {$result['score']}.");
                }
            });

        $this->info("Selesai: {$submitted} attempt dikumpulkan otomatis.");

        return self::SUCCESS;
    }
}
