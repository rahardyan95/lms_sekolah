<?php

namespace App\Contracts;

interface WhatsappGatewayInterface
{
    public function sendMessage(string $to, string $message): array;

    public function checkHealth(): bool;

    public function normalizeError(\Throwable $e): string;
}
