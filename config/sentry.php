<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return [
    'dsn' => env('SENTRY_DSN'),

    // Performa: sampel kecil di production, mati bila DSN kosong.
    'traces_sample_rate' => (float) env('SENTRY_TRACES_SAMPLE_RATE', 0.1),

    'environment' => env('SENTRY_ENVIRONMENT', env('APP_ENV', 'production')),

    // Jangan kirim error validasi/auth yang diharapkan (noise).
    'ignore_exceptions' => [
        ValidationException::class,
        AuthenticationException::class,
        AuthorizationException::class,
        ModelNotFoundException::class,
        NotFoundHttpException::class,
        HttpException::class,
    ],

    'send_default_pii' => false,
];
