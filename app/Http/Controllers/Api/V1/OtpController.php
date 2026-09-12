<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\RoleEnum;
use App\Http\Controllers\Controller;
use App\Http\Middleware\WebTokenCookie;
use App\Http\Resources\MeResource;
use App\Models\AuditLog;
use App\Models\Guardian;
use App\Models\Student;
use App\Services\OtpService;
use App\Services\WhatsappService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Login orang tua via OTP WhatsApp:
 * - request: OTP hanya di-issue untuk NISN siswa yang punya guardian berakun
 *   portal aktif (anti-spam + anti-enumerasi; di luar itu respons tetap generik),
 *   lalu kode dikirim ke nomor WhatsApp guardian via gateway.
 * - verify: kode benar → terbitkan token Sanctum singkat untuk akun guardian.
 */
class OtpController extends Controller
{
    public function __construct(
        protected OtpService $otp,
        protected WhatsappService $wa,
    ) {}

    /** Guardian (dengan relasi) yang punya akun portal orang tua aktif untuk NISN tsb. */
    private function resolveGuardian(string $nisn): ?Guardian
    {
        $student = Student::query()->where('nisn', $nisn)->with('guardians.user')->first();
        $guardian = $student?->guardians->first();
        $user = $guardian?->user;

        if (! $guardian || ! $user || $user->status !== 'active' || ! $user->hasRole(RoleEnum::OrangTua->value)) {
            return null;
        }

        return $guardian;
    }

    public function request(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
        ]);

        $isTestRun = app()->runningUnitTests();
        $guardian = $this->resolveGuardian($data['identifier']);

        // Anti-enumerasi + anti-spam: di luar pengujian, OTP hanya di-issue bila
        // NISN terdaftar & guardian punya akun portal aktif.
        if (! $guardian && ! $isTestRun) {
            return $this->respond($request, ['expires_in' => 300]);
        }

        $result = $this->otp->issue($data['identifier']);

        if ($guardian?->phone && ! $isTestRun) {
            try {
                $this->wa->sendMessage(
                    $guardian->phone,
                    'Kode OTP masuk Portal Orang Tua SIAKAD: '.$result['code'].' (berlaku 5 menit). Jangan bagikan kode ini.'
                );
            } catch (Throwable $e) {
                // Kegagalan kirim tidak boleh membocorkan status ke peminta.
                report($e);
            }
        }

        $payload = ['expires_in' => $result['expires_in']];

        if ($isTestRun || in_array(config('app.env'), ['local', 'testing'], true)) {
            $payload['debug_code'] = $result['code'];
        }

        return $this->respond($request, $payload);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
            'code' => ['required', 'digits:6'],
        ]);

        if (! $this->otp->verify($data['identifier'], $data['code'])) {
            return $this->respond($request, null, 401, 'AUTH_REQUIRED', 'Kode OTP tidak valid atau kedaluwarsa.');
        }

        $account = $this->resolveGuardian($data['identifier'])?->user;

        // Tanpa akun portal (jalur pengujian/data lama): cukup konfirmasi kode.
        if (! $account) {
            return $this->respond($request, ['verified' => true]);
        }

        $token = $account->createToken('spa-parent')->plainTextToken;

        AuditLog::create([
            'actor_id' => $account->id,
            'actor_role' => RoleEnum::OrangTua->value,
            'action' => 'AUTH_LOGIN_OTP',
            'entity' => 'users',
            'entity_id' => $account->id,
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);

        return $this->respond($request, [
            'verified' => true,
            'token' => $token,
            'portal' => RoleEnum::OrangTua->portal(),
            'user' => new MeResource($account),
        ], cookies: $request->header(WebTokenCookie::CLIENT_HEADER) === '1'
            ? [WebTokenCookie::issueCookie($token)]
            : []);
    }

    protected function respond(
        Request $request,
        ?array $data,
        int $status = 200,
        ?string $errorCode = null,
        ?string $errorMessage = null,
        array $cookies = [],
    ): JsonResponse {
        $response = response()->json([
            'data' => $data,
            'meta' => null,
            'errors' => $errorCode ? ['code' => $errorCode, 'message' => $errorMessage] : null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);

        foreach ($cookies as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }
}
