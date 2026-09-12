<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SchoolSetting;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(protected SettingsService $service) {}

    public function index(Request $request): JsonResponse
    {
        $withSecrets = $request->user()->can('manageSettings', SchoolSetting::class);

        return response()->json([
            'data' => $this->service->all($withSecrets),
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $this->authorize('manageSettings', SchoolSetting::class);

        $data = $request->validate([
            'value' => ['present'],
            'version' => ['nullable', 'integer', 'min:1'],
        ]);

        return response()->json([
            'data' => $this->service->set($key, $data['value'], $request->user(), $data['version'] ?? null),
            'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }
}
