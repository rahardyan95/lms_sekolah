<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OtpCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class OtpController extends Controller
{
    public function request(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
        ]);

        OtpCode::where('identifier', $data['identifier'])
            ->whereNull('consumed_at')
            ->delete();

        $code = (string) random_int(100000, 999999);

        OtpCode::create([
            'identifier' => $data['identifier'],
            'purpose' => 'parent_login',
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(5),
        ]);

        if (config('app.env') !== 'production') {
            return response()->json([
                'data' => ['expires_in' => 300, 'debug_code' => $code],
                'meta' => null, 'errors' => null,
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ]);
        }

        return response()->json([
            'data' => ['expires_in' => 300],
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
            'code' => ['required', 'digits:6'],
        ]);

        $otp = OtpCode::where('identifier', $data['identifier'])
            ->whereNull('consumed_at')
            ->latest()
            ->first();

        if (! $otp || $otp->expires_at->isPast() || ! Hash::check($data['code'], $otp->code_hash)) {
            return response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'AUTH_REQUIRED', 'message' => 'Kode OTP tidak valid atau kedaluwarsa.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 401);
        }

        $otp->update(['consumed_at' => now()]);

        return response()->json([
            'data' => ['verified' => true],
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }
}
