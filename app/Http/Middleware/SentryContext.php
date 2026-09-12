<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Sentry\SentrySdk;
use Sentry\State\Scope;
use Symfony\Component\HttpFoundation\Response;

/**
 * Konteks Sentry per-request: role saja (tanpa PII) bila terautentikasi.
 * Dijalankan SETELAH auth:sanctum di grup api (lihat routes/api.php).
 * No-op total bila Sentry tidak terpasang / DSN kosong.
 */
class SentryContext
{
    public function handle(Request $request, Closure $next): Response
    {
        if (class_exists(SentrySdk::class) && $request->user()) {
            \Sentry\configureScope(function (Scope $scope) use ($request): void {
                $scope->setUser([
                    'id' => (string) $request->user()->getAuthIdentifier(),
                    'role' => (string) ($request->user()->getRoleNames()->first() ?? 'unknown'),
                ]);
                $scope->setTag('request_id', (string) $request->header('X-Request-ID', ''));
            });
        }

        return $next($request);
    }
}
