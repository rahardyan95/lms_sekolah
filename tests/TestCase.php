<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Kunci env testing SEBELUM aplikasi di-boot.
     * Wajib karena OS env container (APP_ENV=local, CACHE_STORE=redis, dsb)
     * bisa menimpa <env> phpunit.xml — suite harus hermetic:
     * sqlite :memory:, cache/session/queue array+sync.
     */
    protected function setUp(): void
    {
        foreach ([
            'APP_ENV' => 'testing',
            'BCRYPT_ROUNDS' => '4',
            'CACHE_STORE' => 'array',
            'DB_CONNECTION' => 'sqlite',
            'DB_DATABASE' => ':memory:',
            'MAIL_MAILER' => 'array',
            'QUEUE_CONNECTION' => 'sync',
            'SESSION_DRIVER' => 'array',
            'BROADCAST_CONNECTION' => 'null',
        ] as $key => $value) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        parent::setUp();
    }
}
