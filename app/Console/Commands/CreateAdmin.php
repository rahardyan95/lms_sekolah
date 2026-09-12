<?php

namespace App\Console\Commands;

use App\Services\AdminBootstrapService;
use Illuminate\Console\Command;

/**
 * Bootstrap admin pertama di production (users kosong setelah deploy bersih).
 * Non-interaktif: php artisan admin:create --name=... --email=... --password=...
 * Interaktif: php artisan admin:create (prompt aman, password hidden + konfirmasi).
 */
class CreateAdmin extends Command
{
    protected $signature = 'admin:create
        {--name= : Nama lengkap admin}
        {--email= : Email admin (dipakai sebagai identifier login)}
        {--password= : Password (min. 12 karakter, huruf + angka)}';

    protected $description = 'Buat admin super_admin pertama untuk production';

    public function handle(AdminBootstrapService $service): int
    {
        $name = (string) ($this->option('name') ?: $this->ask('Nama lengkap admin'));
        $email = (string) ($this->option('email') ?: $this->ask('Email admin'));
        $password = (string) ($this->option('password') ?: $this->secret('Password (min. 12 karakter)'));

        if ($this->option('password') === null && $this->secret('Ulangi password') !== $password) {
            $this->error('Konfirmasi password tidak cocok.');

            return self::FAILURE;
        }

        $hadSuperAdmin = $service->hasSuperAdmin();

        try {
            $user = $service->create($name, $email, $password);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($hadSuperAdmin) {
            $this->line(' <comment>WARN</comment> Sistem sudah punya super_admin lain sebelum user ini.');
        }

        $this->info('Admin dibuat:');
        $this->table(['name', 'email', 'role', 'status'], [[
            $user->name, $user->email, 'super_admin', $user->status,
        ]]);

        return self::SUCCESS;
    }
}
