<?php

namespace App\Services;

/**
 * Value object hasil cek kesiapan production.
 * OOP: immutable report berisi checks + helpers go/no-go.
 */
final class ProductionReadinessReport
{
    /**
     * @param  array<int, array{key: string, ok: bool, message: string}>  $checks
     * @param  array<int, string>  $warnings
     */
    public function __construct(
        public readonly array $checks,
        public readonly array $warnings = [],
    ) {}

    public function passed(): int
    {
        return count(array_filter($this->checks, fn (array $c): bool => $c['ok']));
    }

    public function failed(): int
    {
        return count($this->checks) - $this->passed();
    }

    public function isReady(): bool
    {
        return $this->failed() === 0;
    }

    /** @return array<int, array{key: string, ok: bool, message: string}> */
    public function failures(): array
    {
        return array_values(array_filter($this->checks, fn (array $c): bool => ! $c['ok']));
    }
}
