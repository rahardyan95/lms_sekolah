<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;

/**
 * Reset password: selalu respons generik (anti-enumerasi).
 * - forgot : mengirim email berisi tautan SPA /reset-password?token=...&email=...
 * - reset  : memvalidasi token broker lalu mengganti password & mencabut token Sanctum lama.
 */
class PasswordResetController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        Password::sendResetLink(['email' => $data['email']]);

        return response()->json([
            'data' => ['message' => 'Jika email terdaftar, tautan reset telah dikirim.'],
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password_confirmation'] ?? null,
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                $user->password = $password; // cast 'hashed' di model
                $user->save();
                // Cabut semua token Sanctum: setelah reset, sesi lama harus mati.
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'INVALID_RESET_TOKEN', 'message' => 'Tautan reset tidak valid atau sudah kedaluwarsa.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 422);
        }

        return response()->json([
            'data' => ['message' => 'Kata sandi berhasil diubah. Silakan masuk kembali.'],
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }
}
