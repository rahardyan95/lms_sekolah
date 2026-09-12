<?php

namespace Database\Seeders;

use App\Models\SpmbWave;
use Illuminate\Database\Seeder;

/** Satu gelombang demo terbuka (non-production) untuk alur SPMB end-to-end. */
class SpmbDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        SpmbWave::firstOrCreate(
            ['name' => 'Gelombang 1: Jalur Prestasi & Afirmasi'],
            [
                'start_date' => now()->subMonth()->format('Y-m-d'),
                'end_date' => now()->addMonths(2)->format('Y-m-d'),
                'quota' => 150, 'fee' => 200000, 'active' => true,
            ]
        );

        $this->command?->info('SpmbDemoSeeder: 1 gelombang demo terbuka.');
    }
}
