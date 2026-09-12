<?php

namespace App\Jobs;

use App\Contracts\WhatsappGatewayInterface;
use App\Models\Broadcast;
use App\Models\BroadcastLog;
use App\Models\NotificationLog;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Pengiriman broadcast per batch di queue — satu panggilan gateway per penerima
 * tidak boleh memblokir request HTTP. Idempotent per broadcast agar retry tidak
 * menggandakan pengiriman.
 */
class SendBroadcastBatch implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    /** @param array<int, array{name: string, phone: string}> $recipients */
    public function __construct(
        public string $broadcastId,
        public array $recipients,
        /** Retry satu penerima tidak boleh menimpa status agregat induk. */
        public bool $updateBroadcastStatus = true,
    ) {}

    public const TEMPLATE = 'broadcast';

    public function uniqueId(): string
    {
        return 'broadcast:'.$this->broadcastId;
    }

    public function handle(WhatsappGatewayInterface $gateway): void
    {
        $broadcast = Broadcast::find($this->broadcastId);

        if (! $broadcast) {
            return;
        }

        $sent = 0;
        $failed = 0;

        foreach ($this->recipients as $recipient) {
            $log = NotificationLog::firstOrCreate(
                [
                    'channel' => 'whatsapp',
                    'recipient' => $recipient['phone'],
                    'template' => self::TEMPLATE.':'.$this->broadcastId,
                ],
                ['status' => NotificationLog::STATUS_PROCESSING, 'attempts' => 0],
            );
            $log->increment('attempts');
            $log->update(['status' => NotificationLog::STATUS_PROCESSING, 'last_error' => null]);

            try {
                $result = $gateway->sendMessage(
                    $recipient['phone'],
                    "[{$broadcast->title}] {$broadcast->body}"
                );
                $status = ($result['status'] ?? 'failed') === 'sent' ? 'sent' : 'failed';
            } catch (\Throwable $e) {
                $status = 'failed';
                $result = ['error' => class_basename($e)];
            }

            $log->update($status === 'sent'
                ? [
                    'status' => NotificationLog::STATUS_SENT,
                    'provider_ref' => (string) ($result['provider'] ?? 'unknown'),
                    'last_error' => null,
                ]
                : [
                    'status' => NotificationLog::STATUS_FAILED,
                    'last_error' => (string) ($result['error'] ?? 'gateway failed'),
                ]);

            BroadcastLog::create([
                'broadcast_id' => $broadcast->id,
                'recipient_name' => $recipient['name'],
                'recipient_phone' => $recipient['phone'],
                'status' => $status,
                'provider_response' => json_encode($result),
            ]);

            $status === 'sent' ? $sent++ : $failed++;
        }

        if ($this->updateBroadcastStatus) {
            // Status jujur: 'partial' bila sebagian gagal, bukan 'sent'.
            $broadcast->update([
                'status' => match (true) {
                    $sent > 0 && $failed > 0 => 'partial',
                    $sent > 0 => 'sent',
                    default => 'failed',
                },
            ]);
        }
    }
}
