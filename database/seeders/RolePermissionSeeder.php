<?php

namespace Database\Seeders;

use App\Enums\RoleEnum;
use App\Services\DemoAccountService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Cache permission Spatie (redis) harus dibuang dulu agar permission
        // baru langsung terbaca oleh syncPermissions di bawah.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'students.read', 'students.manage',
            'attendance.scan', 'attendance.reports',
            'grades.manage', 'grades.publish',
            'cbt.manage', 'cbt.attempt',
            'finance.payments.record', 'finance.receipts.issue', 'finance.reports.read',
            'spmb.review', 'spmb.accept',
            'cms.manage', 'broadcast.send', 'settings.manage',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        $matrix = [
            RoleEnum::SuperAdmin->value => $permissions,
            RoleEnum::AdminTu->value => ['students.read', 'students.manage', 'attendance.reports', 'spmb.review', 'spmb.accept', 'cms.manage', 'broadcast.send'],
            RoleEnum::Guru->value => ['students.read', 'attendance.scan', 'attendance.reports', 'grades.manage', 'grades.publish', 'cbt.manage'],
            RoleEnum::Bendahara->value => ['students.read', 'finance.payments.record', 'finance.receipts.issue', 'finance.reports.read'],
            RoleEnum::Operator->value => ['students.read', 'attendance.scan', 'attendance.reports', 'spmb.review'],
            RoleEnum::Siswa->value => ['students.read', 'cbt.attempt'],
            RoleEnum::OrangTua->value => ['students.read'],
            RoleEnum::CalonSiswa->value => ['students.read'],
        ];

        foreach ($matrix as $role => $perms) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web'])->syncPermissions($perms);
        }

        // Akun demo (8 role) dibuat via DemoAccountService — TIDAK di production.
        // Password uniform dari SEED_DEMO_PASSWORD (default hanya untuk dev).
        $report = app(DemoAccountService::class)->seedAll();

        if ($report->skippedProduction) {
            $this->command?->warn('RolePermissionSeeder: melewati pembuatan akun demo (APP_ENV=production).');
        } else {
            $this->command?->info('RolePermissionSeeder: '.$report->count().' akun demo siap.');
        }
    }
}
