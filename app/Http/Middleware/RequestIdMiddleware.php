<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Korelasi request frontend (X-Request-ID) dengan log backend.
 * Frontend mengirim X-Request-ID via ApiClient; middleware ini memakai
 * ulang ID tersebut atau membuat baru, lalu memantulkannya di respons
 * agar trace end-to-end bisa diaudit (PRD NFR-015).
 */
class RequestIdMiddleware
{
    public const HEADER = 'X-Request-ID';

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = $this->resolveRequestId($request);
        $request->headers->set(self::HEADER, $requestId);

        Log::shareContext(['request_id' => $requestId]);

        try {
            /** @var Response $response */
            $response = $next($request);
            $response->headers->set(self::HEADER, $requestId);

            return $response;
        } finally {
            // Octane: shared context hidup per-proses, bukan per-request.
            // Dibersihkan setelah respons agar log di luar siklus request
            // (worker tick/task) tidak membawa request_id basi.
            Log::flushSharedContext();
        }
    }

    private function resolveRequestId(Request $request): string
    {
        $incoming = trim((string) $request->header(self::HEADER, ''));

        if ($incoming !== '' && preg_match('/^[A-Za-z0-9][A-Za-z0-9\-_.:]{0,127}$/', $incoming) === 1) {
            return $incoming;
        }

        return (string) Str::uuid();
    }
}
