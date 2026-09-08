<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->hasAnyRole($roles)) {
            return response()->json([
                'data' => null,
                'meta' => null,
                'errors' => ['code' => 'FORBIDDEN', 'message' => 'Akses ditolak.'],
                'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
            ], 403);
        }

        return $next($request);
    }
}
