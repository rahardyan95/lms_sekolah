<?php

namespace App\Services;

use App\Jobs\SendBroadcastBatch;
use App\Models\Broadcast;
use App\Models\Guardian;
use App\Models\Student;
use App\Models\User;

/**
 * Broadcast WA: resolusi penerima per audiens dari data relasional,
 * pengiriman diserahkan ke queue (SendBroadcastBatch) dengan status per-penerima.
 */
class BroadcastService
{
    /** @return array{total: int, sent: int, failed: int} */
    public function send(Broadcast $broadcast): array
    {
        $recipients = $this->recipients($broadcast->audience);

        if ($recipients === []) {
            // Jujur: tidak ada tujuan yang bisa dihubungi. Jangan tandai 'sent'.
            $broadcast->update(['status' => 'failed']);

            return ['total' => 0, 'sent' => 0, 'failed' => 0];
        }

        // Queue sync di test/dev menjalankan inline; produksi mengerjakannya di worker.
        SendBroadcastBatch::dispatch($broadcast->id, $recipients);

        return [
            'total' => count($recipients),
            'sent' => $broadcast->logs()->where('status', 'sent')->count(),
            'failed' => $broadcast->logs()->where('status', 'failed')->count(),
        ];
    }

    /**
     * Resolusi penerima per audiens dari data relasional.
     * Catatan: siswa TIDAK punya nomor sendiri — WA siswa dikirim ke wali
     * (guardians.phone) yang tertaut via pivot guardian_student.
     *
     * @return array<int, array{name: string, phone: string}>
     */
    private function recipients(string $audience): array
    {
        $rows = match ($audience) {
            'siswa' => $this->studentGuardianRecipients(),
            'guru' => $this->guruRecipients(),
            'orang_tua' => $this->guardianRecipients(),
            // 'semua' = gabungan siswa (wali), seluruh wali aktif, dan guru.
            'semua' => array_merge(
                $this->studentGuardianRecipients(),
                $this->guardianRecipients(),
                $this->guruRecipients(),
            ),
            default => $this->guardianRecipients(),
        };

        // Satu nomor hanya dikirimi sekali walau muncul dari beberapa peran.
        $seen = [];
        $unique = [];

        foreach ($rows as $row) {
            if (isset($seen[$row['phone']])) {
                continue;
            }

            $seen[$row['phone']] = true;
            $unique[] = $row;
        }

        return $unique;
    }

    /** @return array<int, array{name: string, phone: string}> */
    private function studentGuardianRecipients(): array
    {
        return Student::with(['guardians:id,name,phone,status'])
            ->get()
            ->flatMap(fn (Student $s) => $s->guardians
                ->where('status', 'active')
                ->map(fn (Guardian $g) => [
                    'name' => $s->name.' (wali: '.$g->name.')',
                    'phone' => (string) $g->phone,
                ])
            )
            ->filter(fn (array $r) => $this->isSendablePhone($r['phone']))->values()->all();
    }

    /** @return array<int, array{name: string, phone: string}> */
    private function guruRecipients(): array
    {
        return User::role('guru')->get()
            ->map(fn (User $u) => ['name' => $u->name, 'phone' => (string) $u->phone])
            ->filter(fn (array $r) => $this->isSendablePhone($r['phone']))->values()->all();
    }

    /** @return array<int, array{name: string, phone: string}> */
    private function guardianRecipients(): array
    {
        return Guardian::where('status', 'active')->get()
            ->map(fn (Guardian $g) => ['name' => $g->name, 'phone' => (string) $g->phone])
            ->filter(fn (array $r) => $this->isSendablePhone($r['phone']))->values()->all();
    }

    /** Nomor harus masuk akal untuk gateway (digit, panjang wajar). */
    private function isSendablePhone(string $phone): bool
    {
        return strlen(preg_replace('/\D/', '', $phone) ?? '') >= 9;
    }
}
