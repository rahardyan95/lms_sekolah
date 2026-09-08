<?php

namespace App\Enums;

enum RoleEnum: string
{
    case SuperAdmin = 'super_admin';
    case AdminTu = 'admin_tu';
    case Guru = 'guru';
    case Bendahara = 'bendahara';
    case Operator = 'operator';
    case Siswa = 'siswa';
    case OrangTua = 'orang_tua';
    case CalonSiswa = 'calon_siswa';

    public function portal(): string
    {
        return match ($this) {
            self::Siswa => 'student',
            self::OrangTua => 'parent',
            self::CalonSiswa => 'spmb',
            self::Guru => 'academic',
            self::Bendahara => 'finance',
            self::Operator => 'attendance',
            default => 'dashboard',
        };
    }

    public function guard(): string
    {
        return match ($this) {
            self::Siswa => 'student',
            self::OrangTua => 'parent',
            self::CalonSiswa => 'spmb',
            self::Guru, self::Bendahara, self::Operator => 'staff',
            default => 'admin',
        };
    }
}
