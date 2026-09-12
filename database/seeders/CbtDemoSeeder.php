<?php

namespace Database\Seeders;

use App\Enums\RoleEnum;
use App\Models\CbtExam;
use App\Models\User;
use App\Services\CbtService;
use Illuminate\Database\Seeder;

/**
 * Satu ujian demo published (cermin mockData frontend) agar alur CBT server-side
 * bisa diuji end-to-end. Non-production only.
 */
class CbtDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        if (CbtExam::where('title', 'like', '%Pemrograman Web & Bergerak%')->exists()) {
            return;
        }

        $author = User::role(RoleEnum::Guru->value)->first()
            ?? User::role(RoleEnum::SuperAdmin->value)->first();

        $options = fn (string $a, string $b, string $c, string $d, string $e): array => [
            'A' => $a, 'B' => $b, 'C' => $c, 'D' => $d, 'E' => $e,
        ];

        app(CbtService::class)->createExam($author, [
            'title' => 'Penilaian Tengah Semester: Pemrograman Web & Bergerak',
            'subject_name' => 'Pemrograman Web & Perangkat Bergerak',
            'kelas' => 'X RPL 1',
            'duration_minutes' => 60,
            'date' => now(config('school.timezone', 'Asia/Jakarta'))->format('Y-m-d'),
            'time_start' => '00:00',
            'time_end' => '23:59',
            'status' => CbtExam::STATUS_PUBLISHED,
            'questions' => [
                [
                    'question' => 'Protokol yang menjamin transmisi data terenkripsi end-to-end pada arsitektur web modern?',
                    'options' => $options('HTTP/1.1 tanpa sertifikat SSL', 'HTTPS dengan protokol TLS 1.3', 'FTP port 21', 'Telnet port 23', 'SNMP v1 komunitas publik'),
                    'correct_answer' => 'B',
                    'explanation' => 'HTTPS dengan TLS 1.3 mengenkripsi payload HTTP.',
                ],
                [
                    'question' => 'Urutan layer CSS Box Model dari paling dalam hingga paling luar?',
                    'options' => $options('Margin → Border → Padding → Content', 'Content → Padding → Border → Margin', 'Content → Border → Padding → Margin', 'Padding → Content → Margin → Border', 'Border → Padding → Content → Margin'),
                    'correct_answer' => 'B',
                    'explanation' => 'Content, Padding, Border, Margin.',
                ],
                [
                    'question' => 'Metode HTTP idempotent untuk memperbarui seluruh representasi sumber daya?',
                    'options' => $options('POST', 'PATCH', 'PUT', 'CONNECT', 'OPTIONS'),
                    'correct_answer' => 'C',
                    'explanation' => 'PUT bersifat idempotent (RFC 9110).',
                ],
                [
                    'question' => 'Tipe data PostgreSQL paling optimal untuk identitas unik terdistribusi?',
                    'options' => $options('VARCHAR(255)', 'BIGINT AUTO_INCREMENT', 'UUID v4 / v7', 'TEXT', 'BOOLEAN'),
                    'correct_answer' => 'C',
                    'explanation' => 'UUID 128-bit tanpa koordinasi pusat.',
                ],
                [
                    'question' => 'Perintah Git membatalkan commit terakhir namun mempertahankan working directory?',
                    'options' => $options('git reset --hard HEAD~1', 'git reset --soft HEAD~1', 'git clean -fd', 'git checkout -- .', 'git branch -D main'),
                    'correct_answer' => 'B',
                    'explanation' => 'git reset --soft memundurkan HEAD tanpa menyentuh working directory.',
                ],
            ],
        ]);

        $this->command?->info('CbtDemoSeeder: 1 ujian demo published.');
    }
}
