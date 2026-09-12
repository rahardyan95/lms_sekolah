<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sesi web hibrida: bila klien web (header X-Web-Client) login, token juga
 * disimpan di cookie httpOnly `lms_web`. Middleware ini menyalinnya ke
 * header Authorization (bila Bearer absen) agar guard Sanctum token tetap
 * satu-satunya penegak auth, plus CSRF stateless untuk mutasi via cookie.
 */
class WebTokenCookie
{
    public const COOKIE = 'lms_web';

    public const CLIENT_HEADER = 'X-Web-Client';

    public const CSRF_COOKIE = 'XSRF-TOKEN';

    public const CSRF_HEADER = 'X-XSRF-TOKEN';

    public static function minutes(): int
    {
        $exp = config('sanctum.expiration');

        return is_numeric($exp) && (int) $exp > 0 ? (int) $exp : 120;
    }

    public static function issueCookie(string $token): Cookie
    {
        return cookie(
            self::COOKIE,
            $token,
            self::minutes(),
            '/',
            null,
            (bool) config('session.secure', false),
            true,
            false,
            config('session.same_site', 'lax')
        );
    }

    public static function forgetCookie(): Cookie
    {
        return cookie()->forget(self::COOKIE, '/');
    }

    public function handle(Request $request, Closure $next): Response
    {
        $cookieToken = $request->cookie(self::COOKIE);

        if ($cookieToken && ! $request->bearerToken()) {
            $request->headers->set('Authorization', 'Bearer '.$cookieToken);

            if (! $request->isMethodCacheable()) {
                $this->assertCsrf($request);
            }
        }

        /** @var Response $response */
        $response = $next($request);

        return $response;
    }

    private function assertCsrf(Request $request): void
    {
        $cookie = (string) $request->cookie(self::CSRF_COOKIE, '');
        $header = (string) $request->header(self::CSRF_HEADER, '');

        if ($cookie === '' || $header === '' || ! hash_equals($cookie, $header)) {
            abort(response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'CSRF_MISMATCH', 'message' => 'Token CSRF tidak valid. Muat ulang sesi.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 419));
        }
    }
}
