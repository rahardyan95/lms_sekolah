<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    private const HSTS_MAX_AGE = 31536000;

    private const REFERRER_POLICY = 'strict-origin-when-cross-origin';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', self::REFERRER_POLICY);
        $response->headers->set('Permissions-Policy', $this->permissionsPolicy($request));
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');

        if ($this->shouldEnforceHsts($request)) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age='.self::HSTS_MAX_AGE.'; includeSubDomains; preload'
            );
        }

        return $response;
    }

    /**
     * Kamera dibutuhkan modul presensi QR; izinkan self saja agar
     * getUserMedia tetap jalan di origin aplikasi, blokir mic/geolocation.
     */
    private function permissionsPolicy(Request $request): string
    {
        if ($request->is('api/v1/attendance/*')) {
            return 'camera=(self), microphone=(), geolocation=()';
        }

        return 'camera=(self), microphone=(), geolocation=()';
    }

    private function shouldEnforceHsts(Request $request): bool
    {
        if ($request->isSecure()) {
            return true;
        }

        // Di belakang TLS-terminating proxy (Caddy/Nginx), Laravel tahu HTTPS
        // via X-Forwarded-Proto + TRUSTED_PROXIES. Paksa HSTS di production
        // agar browser selalu upgrade, meski pengecekan isSecure gagal.
        return app()->environment('production')
            && ($request->header('X-Forwarded-Proto') === 'https'
                || config('app.url', '') !== '' && str_starts_with((string) config('app.url'), 'https://'));
    }
}
