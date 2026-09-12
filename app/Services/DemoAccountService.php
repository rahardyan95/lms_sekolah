<?php

namespace App\Services;

use App\Enums\RoleEnum;
use App\Models\ClassRoom;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Single-responsibility service pembuat 8 akun demo (satu per role).
 * Idempotent via firstOrCreate; TIDAK jalan di production.
 * Password uniform dari SEED_DEMO_PASSWORD (default password123, dev only).
 */
class DemoAccountService
{
    public const DEMO_STUDENT_NISN = '0071829384';

    public const DEMO_STUDENT_BIRTH_DATE = '2008-04-15';

    public const DEMO_SPMB_REGNO = 'SPMB-2026-0089';

    public function seedAll(): DemoSeedReport
    {
        if (app()->environment('production')) {
            return new DemoSeedReport([], true);
        }

        $password = Hash::make((string) env('SEED_DEMO_PASSWORD', 'password123'));
        $report = [];

        $staff = [
            ['Super Admin', 'superadmin@sekolah.sch.id', 'superadmin', RoleEnum::SuperAdmin],
            ['Admin TU', 'admin@sekolah.sch.id', 'admin', RoleEnum::AdminTu],
            ['Guru', 'guru@sekolah.sch.id', 'guru', RoleEnum::Guru],
            ['Bendahara', 'bendahara@sekolah.sch.id', 'bendahara', RoleEnum::Bendahara],
            ['Operator', 'operator@sekolah.sch.id', 'operator', RoleEnum::Operator],
        ];

        foreach ($staff as [$name, $email, $identifier, $role]) {
            $user = $this->makeUser($name, $email, $identifier, $password, $role);
            $report[] = $this->row($role, $identifier, $email);
        }

        // Siswa: identifier = NISN, tertaut ke students.nisn yang sama.
        $studentUser = $this->makeUser(
            'Ahmad Fauzi Rahman (Siswa Demo)',
            'siswa.demo@sekolah.sch.id',
            self::DEMO_STUDENT_NISN,
            $password,
            RoleEnum::Siswa
        );

        $classRoom = ClassRoom::firstOrCreate(
            ['name' => 'X RPL 1'],
            ['grade' => 'X', 'major' => 'Rekayasa Perangkat Lunak']
        );

        $student = Student::firstOrCreate(
            ['nisn' => self::DEMO_STUDENT_NISN],
            [
                'user_id' => $studentUser->id,
                'name' => 'Ahmad Fauzi Rahman',
                'gender' => 'L',
                'birth_date' => self::DEMO_STUDENT_BIRTH_DATE,
                'class_room_id' => $classRoom->id,
                'status' => 'active',
            ]
        );
        if ($student->user_id === null) {
            $student->update(['user_id' => $studentUser->id]);
        }
        // Portal orang tua memakai NISN + tanggal lahir anak; pastikan terisi
        // agar akun demo benar-benar bisa dipakai tanpa menebak data.
        if ($student->birth_date === null) {
            $student->update(['birth_date' => self::DEMO_STUDENT_BIRTH_DATE]);
        }
        $report[] = $this->row(RoleEnum::Siswa, self::DEMO_STUDENT_NISN, 'siswa.demo@sekolah.sch.id');

        // Orang tua: User role orang_tua <- guardians.user_id <- pivot -> student.
        $parentUser = $this->makeUser(
            'Bpk. Bambang Sudiro (Ortu Demo)',
            'ortu.demo@sekolah.sch.id',
            'ortu-'.self::DEMO_STUDENT_NISN,
            $password,
            RoleEnum::OrangTua
        );

        $guardian = Guardian::firstOrCreate(
            ['user_id' => $parentUser->id],
            ['name' => 'Bpk. Bambang Sudiro', 'phone' => '081289123456', 'status' => 'active']
        );
        $guardian->students()->syncWithoutDetaching([$student->id]);
        $report[] = $this->row(RoleEnum::OrangTua, self::DEMO_STUDENT_NISN.' + OTP', 'ortu.demo@sekolah.sch.id');

        // Calon siswa: identifier = nomor registrasi SPMB.
        $this->makeUser(
            'Muhammad Dimas Saputra (SPMB Demo)',
            'spmb.demo@sekolah.sch.id',
            self::DEMO_SPMB_REGNO,
            $password,
            RoleEnum::CalonSiswa
        );
        $report[] = $this->row(RoleEnum::CalonSiswa, self::DEMO_SPMB_REGNO, 'spmb.demo@sekolah.sch.id');

        return new DemoSeedReport($report);
    }

    private function makeUser(string $name, string $email, string $identifier, string $hashedPassword, RoleEnum $role): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'identifier' => $identifier, 'password' => $hashedPassword, 'status' => 'active']
        );

        // Jaga identifier tetap sinkron bila row sudah ada dari seed lama.
        if ($user->identifier !== $identifier) {
            $user->update(['identifier' => $identifier]);
        }

        $user->assignRole($role->value);

        return $user;
    }

    /** @return array{role: string, identifier: string, email: string, portal: string, skipped: bool} */
    private function row(RoleEnum $role, string $identifier, string $email): array
    {
        return [
            'role' => $role->value,
            'identifier' => $identifier,
            'email' => $email,
            'portal' => $role->portal(),
            'skipped' => false,
        ];
    }
}
