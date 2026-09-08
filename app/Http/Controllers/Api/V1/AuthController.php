<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\RoleEnum;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\MeResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        if (config('app.env') !== 'testing') {
            $key = 'login:'.str($request->ip())->toString().':'.$request->string('identifier');
            if (RateLimiter::tooManyAttempts($key, 10)) {
                return $this->error('RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.', 429);
            }
            RateLimiter::hit($key, 900);
        }

        $user = User::where('email', $request->string('identifier'))
            ->orWhere('identifier', $request->string('identifier'))
            ->first();

        if (! $user || $user->status !== 'active' || ! Hash::check($request->string('password'), $user->password)) {
            return $this->error('AUTH_REQUIRED', 'Kredensial tidak valid.', 401);
        }

        if (config('app.env') !== 'testing' && isset($key)) {
            RateLimiter::clear($key);
        }
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $token = $user->createToken('spa')->plainTextToken;

        AuditLog::create([
            'actor_id' => $user->id,
            'actor_role' => $user->getRoleNames()->first(),
            'action' => 'AUTH_LOGIN',
            'entity' => 'users',
            'entity_id' => $user->id,
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);

        $role = RoleEnum::tryFrom((string) ($user->getRoleNames()->first() ?? ''));

        return response()->json([
            'data' => [
                'token' => $token,
                'portal' => $role?->portal() ?? 'dashboard',
                'user' => new MeResource($user),
            ],
            'meta' => null,
            'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new MeResource($request->user()),
            'meta' => null,
            'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'data' => ['message' => 'Logout berhasil.'],
            'meta' => null,
            'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    protected function error(string $code, string $message, int $status): JsonResponse
    {
        return response()->json([
            'data' => null,
            'meta' => null,
            'errors' => ['code' => $code, 'message' => $message],
            'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }
}
