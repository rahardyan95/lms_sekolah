<?php

use App\Models\Post;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/** SEO dasar situs publik: sitemap dari postingan terpublikasi (client.md: SEO ramah). */
Route::get('/sitemap.xml', function () {
    $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

    $posts = Post::where('status', Post::STATUS_PUBLISHED)
        ->orderByDesc('published_at')
        ->get(['slug', 'published_at', 'updated_at']);

    return response()
        ->view('sitemap', [
            'posts' => $posts,
            'base' => $base,
            // Dirakit di PHP: literal `<?xml` di dalam Blade membingungkan kompilator.
            'declaration' => '<?'.'xml version="1.0" encoding="UTF-8"?'.'>',
        ])
        ->header('Content-Type', 'application/xml');
});

Route::get('/robots.txt', function () {
    $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

    return response("User-agent: *\nAllow: /\nSitemap: {$base}/sitemap.xml\n", 200)
        ->header('Content-Type', 'text/plain');
});

// Readiness probe: cek ketergantungan inti (DB + Redis) — dipakai orkestrator/load balancer,
// beda dari liveness /up yang hanya memastikan proses PHP hidup.
Route::get('/healthz', function () {
    try {
        DB::select('select 1');
        $db = 'ok';
    } catch (Throwable) {
        $db = 'down';
    }

    try {
        Cache::store(config('cache.default'))->get('healthz-ping');
        $cache = 'ok';
    } catch (Throwable) {
        $cache = 'down';
    }

    $healthy = $db === 'ok' && $cache === 'ok';

    return response()->json([
        'status' => $healthy ? 'ok' : 'degraded',
        'db' => $db,
        'cache' => $cache,
        'time' => now()->toIso8601String(),
    ], $healthy ? 200 : 503);
});
