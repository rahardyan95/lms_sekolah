<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // DEC-001 (locked 11 Sep 2026 untuk go-live): primary Fonnte, fallback Wablas.
    // Custom API out untuk rilis pertama. Default 'log' dev-safe; production
    // wajib provider nyata (dienforce app:readiness + ProductionReadinessService).
    'whatsapp' => [
        'provider' => env('WA_PROVIDER', 'log'),
        'endpoint' => env('WA_ENDPOINT'),
        'key' => env('WA_API_KEY'),
        'sender' => env('WA_SENDER'),
        // Penyedia cadangan + kredensialnya (bila kosong → pakai kredensial utama).
        'fallback_provider' => env('WA_FALLBACK_PROVIDER'),
        'fallback_endpoint' => env('WA_FALLBACK_ENDPOINT'),
        'fallback_key' => env('WA_FALLBACK_API_KEY'),
    ],

    'backup' => [
        // Offsite S3-compatible untuk RPO penuh (lihat scripts/backup.sh + docs/RUNBOOK.md).
        'bucket' => env('BACKUP_S3_BUCKET'),
        'endpoint' => env('BACKUP_S3_ENDPOINT'),
    ],

    'meilisearch' => [
        'host' => env('MEILISEARCH_HOST', 'http://meilisearch:7700'),
        'key' => env('MEILI_MASTER_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
