<?php

namespace App\Services;

use App\Enums\RoleEnum;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Single-responsibility service bootstrap admin pertama di production
 * (seeder demo sengaja tidak jalan saat APP_ENV=production).
 */
class AdminBootstrapService
{
    private const WEAK_PASSWORDS = [
        'password', 'password123', 'changeme', 'admin', 'secret', '12345678', 'qwerty',
    ];

    /**
     * @throws \InvalidArgumentException bila input tidak valid / email sudah dipakai.
     */
    public function create(string $name, string $email, string $password): User
    {
        $name = trim($name);
        $email = strtolower(trim($email));

        if ($name === '' || mb_strlen($name) < 3) {
            throw new \InvalidArgumentException('Nama admin wajib diisi (minimal 3 karakter).');
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Email tidak valid.');
        }

        $this->assertStrongPassword($password);

        if (User::query()->where('email', $email)->exists()) {
            throw new \InvalidArgumentException("Email {$email} sudah terdaftar.");
        }

        $user = User::query()->create([
            'name' => $name,
            'email' => $email,
            'identifier' => $email,
            'password' => Hash::make($password),
            'status' => 'active',
        ]);

        $user->assignRole(RoleEnum::SuperAdmin->value);

        return $user;
    }

    public function hasSuperAdmin(): bool
    {
        return User::query()->whereHas('roles', fn ($q) => $q->where('name', RoleEnum::SuperAdmin->value))->exists();
    }

    /**
     * @throws \InvalidArgumentException
     */
    private function assertStrongPassword(string $password): void
    {
        if (strlen($password) < 12) {
            throw new \InvalidArgumentException('Password minimal 12 karakter.');
        }

        if (in_array(strtolower($password), self::WEAK_PASSWORDS, true)) {
            throw new \InvalidArgumentException('Password terlalu lemah / terdaftar sebagai password umum.');
        }

        if (! preg_match('/[A-Za-z]/', $password) || ! preg_match('/\d/', $password)) {
            throw new \InvalidArgumentException('Password harus mengandung huruf dan angka.');
        }
    }
}
