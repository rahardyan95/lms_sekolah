<?php

namespace App\Http\Requests;

use App\Services\SettingsService;
use Illuminate\Foundation\Http\FormRequest;

class ScanAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('attendance.scan') || $this->user()->hasAnyRole(['super_admin', 'admin_tu', 'guru', 'operator']);
    }

    public function rules(): array
    {
        $tz = (string) (app(SettingsService::class)->value('timezone') ?: config('school.timezone', 'Asia/Jakarta'));
        $today = now($tz)->toDateString();

        return [
            'nisn' => ['required', 'string', 'max:20'],
            // Scan gerbang hanya untuk presensi hari berjalan (zona sekolah).
            // Koreksi tanggal lain lewat entri manual yang wajib alasan + audit.
            'date' => ['required', 'date', 'date_format:Y-m-d', 'in:'.$today],
            'device' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:64'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'date.in' => 'Presensi scan hanya untuk hari ini. Untuk tanggal lain gunakan entri manual (wajib alasan).',
            'date.required' => 'Tanggal presensi wajib diisi.',
            'date.date_format' => 'Format tanggal harus YYYY-MM-DD.',
            'nisn.required' => 'NISN wajib diisi.',
        ];
    }
}
