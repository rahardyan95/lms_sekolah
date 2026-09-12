<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\RequestIdMiddleware;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SentryContext;
use App\Http\Middleware\WebTokenCookie;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Satu panggilan alias(): Middleware::alias() MENIMPA, bukan merge —
        // dua panggilan terpisah akan menghapus alias yang pertama.
        $middleware->alias([
            'role' => EnsureRole::class,
            'sentry.context' => SentryContext::class,
        ]);

        // Wajib di belakang TLS-terminating proxy: rate-limit & audit log berbasis IP
        // harus melihat IP asli klien, bukan IP proxy (lihat docs/DEPLOY.md).
        $middleware->trustProxies(
            at: array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', '*')))), // @phpstan-ignore-line
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO
                | Request::HEADER_X_FORWARDED_AWS_ELB,
        );

        // Security headers minimum untuk semua respons.
        // Request-ID dulu agar log SecurityHeaders dkk terkorelasi.
        $middleware->append(RequestIdMiddleware::class);
        // WebTokenCookie global (bukan route): harus jalan SEBELUM auth:sanctum
        // karena Laravel memprioritaskan Authenticate di atas middleware route.
        $middleware->append(WebTokenCookie::class);
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Envelope error API terpusat: semua error framework memakai format
        // {status, errors: {code, message}} yang konsisten dengan controller.
        $apiError = static function (Request $request, int $status, string $code, string $message) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'status' => 'error',
                'errors' => ['code' => $code, 'message' => $message],
                'message' => $message,
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], $status);
        };

        $exceptions->render(fn (AuthenticationException $e, Request $r) => $apiError($r, 401, 'AUTH_REQUIRED', 'Unauthenticated.'));
        $exceptions->render(fn (AuthorizationException $e, Request $r) => $apiError($r, 403, 'FORBIDDEN', 'Anda tidak memiliki izin untuk aksi ini.'));
        $exceptions->render(fn (ModelNotFoundException $e, Request $r) => $apiError($r, 404, 'NOT_FOUND', 'Data tidak ditemukan.'));
        $exceptions->render(fn (NotFoundHttpException $e, Request $r) => $apiError($r, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.'));
        $exceptions->render(fn (TooManyRequestsHttpException $e, Request $r) => $apiError($r, 429, 'TOO_MANY_REQUESTS', 'Terlalu banyak permintaan. Coba lagi beberapa saat.'));

        // HttpException polos dari service (abort/throw 4xx bisnis) juga wajib
        // memakai envelope: frontend membaca errors.code + request_id. Jalur
        // `abort(response()->json([...]))` tidak lewat sini karena melempar
        // HttpResponseException yang membawa respons utuh. Ditulis terhadap
        // HttpExceptionInterface agar menangkap Symfony maupun Illuminate.
        $exceptions->render(function (HttpExceptionInterface $e, Request $r) use ($apiError) {
            $status = $e->getStatusCode();
            $code = match (true) {
                $status === 409 => 'CONFLICT',
                $status === 422 => 'VALIDATION',
                $status === 403 => 'FORBIDDEN',
                $status === 404 => 'NOT_FOUND',
                $status === 429 => 'TOO_MANY_REQUESTS',
                default => 'HTTP_ERROR',
            };
            $message = $e->getMessage() !== '' ? $e->getMessage() : 'Permintaan ditolak.';

            return $apiError($r, $status, $code, $message);
        });

        $exceptions->render(function (ValidationException $e, Request $r) use ($apiError) {
            $message = $e->validator->errors()->first() ?: 'Data yang dikirim tidak valid.';

            return $apiError($r, 422, 'VALIDATION', $message);
        });
    })
    ->withSchedule(function (Schedule $schedule): void {
        // Backup TIAP JAM (RPO ≤1 jam) ke storage/app/backups (volume storage_data).
        // keep=48 → retensi lokal 2 hari; retensi panjang dikelola di bucket S3 offsite.
        $schedule->command('db:backup --keep=48')->hourlyAt(5)->timezone('Asia/Jakarta')->onFailure(function () {
            Log::error('db.backup.schedule.failed');
        });
        // Monitor tiap jam: queue gagal, umur backup (ambang 2 jam karena backup hourly), redis.
        $schedule->command('app:monitor --max-backup-hours=2')->hourly()->timezone('Asia/Jakarta');
        // Auto-submit CBT: attempt yang melewati deadline dikumpulkan otomatis.
        $schedule->command('cbt:auto-submit')->everyMinute()->timezone('Asia/Jakarta');
    })->create();
