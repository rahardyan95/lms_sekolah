<?php

namespace App\Services;

/**
 * Value object hasil seeding akun demo (OOP, immutable).
 */
final class DemoSeedReport
{
    /**
     * @param  array<int, array{role: string, identifier: string, email: string, portal: string, skipped: bool}>  $accounts
     */
    public function __construct(
        public readonly array $accounts,
        public readonly bool $skippedProduction = false,
    ) {}

    public function count(): int
    {
        return count($this->accounts);
    }

    /** @return array<int, string> */
    public function identifiers(): array
    {
        return array_map(fn (array $a): string => $a['identifier'], $this->accounts);
    }
}
