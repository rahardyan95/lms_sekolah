<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\BroadcastLog;
use App\Services\BroadcastService;
use App\Services\WhatsappService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BroadcastController extends Controller
{
    public function __construct(protected BroadcastService $service) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('sendBroadcast', Broadcast::class);

        return $this->envelope($request, Broadcast::withCount('logs')->orderByDesc('created_at')->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('sendBroadcast', Broadcast::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:1000'],
            'audience' => ['required', 'in:'.implode(',', Broadcast::AUDIENCES)],
        ]);

        $broadcast = Broadcast::create([
            ...$data, 'status' => 'queued', 'created_by' => $request->user()->id,
        ]);

        $report = $this->service->send($broadcast);

        return $this->envelope($request, [
            'broadcast' => $broadcast->refresh(),
            'delivery' => $report,
            // Pesan operator: 0 penerima berarti belum ada nomor tujuan yang bisa
            // dihubungi (mis. guru tanpa nomor WA, siswa tanpa data wali).
            'message' => $report['total'] === 0
                ? 'Tidak ada penerima dengan nomor WhatsApp yang valid untuk audiens ini.'
                : null,
        ], 201);
    }

    public function logs(Request $request, Broadcast $broadcast): JsonResponse
    {
        $this->authorize('sendBroadcast', Broadcast::class);

        // Nomor penerima sengaja dibuka di sini (petugas perlu untuk dead-letter
        // view) meski model menyembunyikannya dari serialisasi umum.
        $logs = $broadcast->logs()->orderByDesc('created_at')->paginate(50)
            ->through(fn (BroadcastLog $log) => [
                'id' => $log->id,
                'recipient_name' => $log->recipient_name,
                'recipient_phone' => (string) $log->recipient_phone,
                'status' => $log->status,
                'provider_response' => $log->provider_response,
                'created_at' => $log->created_at,
            ]);

        return $this->envelope($request, $logs);
    }

    /** Uji koneksi gateway (dengan fallback provider) dari panel admin. */
    public function testMessage(Request $request, WhatsappService $gateway): JsonResponse
    {
        $this->authorize('sendBroadcast', Broadcast::class);

        $data = $request->validate([
            'phone' => ['required', 'string', 'max:32'],
        ]);

        $result = $gateway->sendWithFallback(
            $data['phone'],
            'Tes koneksi WhatsApp Gateway '.config('school.name').' pada '.now()->toDateTimeString().'.'
        );

        return $this->envelope($request, $result);
    }
}
