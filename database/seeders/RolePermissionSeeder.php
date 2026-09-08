<?php

namespace Database\Seeders;

use App\Enums\RoleEnum;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'students.read', 'students.manage',
            'attendance.scan', 'attendance.reports',
            'grades.manage', 'grades.publish',
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
            RoleEnum::Guru->value => ['students.read', 'attendance.scan', 'attendance.reports', 'grades.manage', 'grades.publish'],
            RoleEnum::Bendahara->value => ['students.read', 'finance.payments.record', 'finance.receipts.issue', 'finance.reports.read'],
            RoleEnum::Operator->value => ['students.read', 'attendance.scan', 'attendance.reports', 'spmb.review'],
            RoleEnum::Siswa->value => ['students.read'],
            RoleEnum::OrangTua->value => ['students.read'],
            RoleEnum::CalonSiswa->value => ['students.read'],
        ];

        foreach ($matrix as $role => $perms) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web'])->syncPermissions($perms);
        }

        $accounts = [
            ['Super Admin', 'superadmin@sekolah.sch.id', 'super_admin', RoleEnum::SuperAdmin],
            ['Admin TU', 'admin@sekolah.sch.id', 'admin_tu', RoleEnum::AdminTu],
            ['Guru', 'guru@sekolah.sch.id', 'guru', RoleEnum::Guru],
            ['Bendahara', 'bendahara@sekolah.sch.id', 'bendahara', RoleEnum::Bendahara],
            ['Operator', 'operator@sekolah.sch.id', 'operator', RoleEnum::Operator],
        ];

        foreach ($accounts as [$name, $email, $identifier, $role]) {
            $user = User::firstOrCreate(
                ['email' => $email],
                ['name' => $name, 'identifier' => $identifier, 'password' => Hash::make('password123'), 'status' => 'active']
            );
            $user->assignRole($role->value);
        }
    }
}
