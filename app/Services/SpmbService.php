<?php

namespace App\Services;

use App\Enums\RoleEnum;
use App\Models\AuditLog;
use App\Models\SpmbApplication;
use App\Models\SpmbWave;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * SPMB: pendaftaran publik → verifikasi → keputusan → konversi idempotent
 * menjadi akun siswa aktif. Berkas privat (disk lokal, allowlist ketat).
 */
class SpmbService
{
    public function __construct(protected SettingsService $settings) {}

    public function submit(SpmbWave $wave, array $data, ?User $actor = null): SpmbApplication
    {
        // Sakelar SPMB: default terbuka bila belum diatur (kompatibel mundur).
        $open = $this->settings->flag('spmb_open', true);
        $testMode = $this->settings->flag('spmb_test_mode', false);
        $tester = $testMode && $actor !== null && $actor->can('review', SpmbApplication::class);
        $isTest = ! $open && $tester;

        if (! $open && ! $tester) {
            abort(response()->json([
                'data' => null, 'meta' => null,
                'errors' => ['code' => 'SPMB_CLOSED', 'message' => 'Pendaftaran SPMB sedang ditutup.'],
                'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
            ], 422));
        }

        if (! $wave->isOpen()) {
            throw new HttpException(422, 'Gelombang pendaftaran tutup atau belum dibuka.');
        }

        // Cek kuota + insert dalam satu transaksi dengan lock baris gelombang:
        // dua submit paralel pada sisa 1 kuota tidak bisa sama-sama lolos.
        $application = DB::transaction(function () use ($wave, $data, $isTest) {
            $locked = SpmbWave::whereKey($wave->id)->lockForUpdate()->firstOrFail();

            if ($locked->filledCount() >= $locked->quota) {
                throw new HttpException(422, 'Kuota gelombang sudah penuh.');
            }

            return $this->persistApplication($locked, $data, $isTest);
        });

        if ($isTest) {
            AuditLog::create([
                'actor_id' => $actor->id,
                'actor_role' => $actor->getRoleNames()->first(),
                'action' => 'SPMB_TEST_SUBMIT',
                'entity' => 'spmb_applications',
                'entity_id' => $application->id,
                'after' => ['registration_number' => $application->registration_number],
                'ip_address' => request()->ip(),
                'request_id' => request()->header('X-Request-ID'),
            ]);
        }

        return $application;
    }

    /**
     * Nomor pendaftaran unik: probe tanpa lock tidak cukup, jadi create diulang
     * saat constraint registration_number menolak (balapan submit bersamaan).
     */
    private function persistApplication(SpmbWave $wave, array $data, bool $isTest = false): SpmbApplication
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                return SpmbApplication::create([
                    'registration_number' => $this->nextRegNumber($wave),
                    'wave_id' => $wave->id,
                    'name' => $data['name'],
                    'nisn' => $data['nisn'],
                    'nik' => $data['nik'] ?? null,
                    'gender' => $data['gender'],
                    'birth_place' => $data['birth_place'] ?? null,
                    'birth_date' => $data['birth_date'] ?? null,
                    'parent_name' => $data['parent_name'],
                    'parent_phone' => $data['parent_phone'] ?? null,
                    'previous_school' => $data['previous_school'] ?? null,
                    'average_score' => $data['average_score'] ?? null,
                    'chosen_major' => $data['chosen_major'] ?? null,
                    'notes' => $isTest ? '[TEST] Pendaftaran mode pengujian admin.' : null,
                    'status' => SpmbApplication::STATUS_DRAFT,
                ]);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt === 2) {
                    throw $e;
                }
            }
        }

        throw new RuntimeException('Unreachable');
    }

    public function verify(SpmbApplication $application, User $verifier): SpmbApplication
    {
        return DB::transaction(function () use ($application, $verifier) {
            $fresh = SpmbApplication::whereKey($application->id)->firstOrFail();

            if ($fresh->status !== SpmbApplication::STATUS_DRAFT) {
                throw new HttpException(422, 'Hanya draft yang bisa diverifikasi.');
            }

            // Urutan lock seragam dengan submit(): baris gelombang dulu, lalu
            // baris aplikasi — cegah kuota terlampaui pada verify paralel.
            $wave = $fresh->wave_id
                ? SpmbWave::whereKey($fresh->wave_id)->lockForUpdate()->first()
                : null;

            if ($wave && $wave->filledCount() >= $wave->quota) {
                throw new HttpException(422, 'Kuota gelombang sudah penuh.');
            }

            $fresh->update([
                'status' => SpmbApplication::STATUS_VERIFIED,
                'verified_by' => $verifier->id,
                'verified_at' => now(),
            ]);

            return $fresh->refresh();
        });
    }

    public function decide(SpmbApplication $application, User $decider, string $status, ?string $notes): SpmbApplication
    {
        if (! in_array($status, [SpmbApplication::STATUS_ACCEPTED, SpmbApplication::STATUS_REJECTED], true)) {
            throw new HttpException(422, 'Keputusan tidak valid.');
        }

        if ($application->status !== SpmbApplication::STATUS_VERIFIED) {
            throw new HttpException(422, 'Hanya berkas terverifikasi yang bisa diputuskan.');
        }

        if ($status === SpmbApplication::STATUS_REJECTED && blank($notes)) {
            throw new HttpException(422, 'Alasan penolakan wajib diisi.');
        }

        // verified_by/verified_at milik VERIFIKATOR tidak ditimpa di sini:
        // keputusan dicatat di audit log agar jejak verifikasi tetap utuh.
        $application->update([
            'status' => $status,
            'notes' => $notes,
        ]);

        AuditLog::create([
            'actor_id' => $decider->id,
            'actor_role' => $decider->getRoleNames()->first(),
            'action' => 'SPMB_DECIDE',
            'entity' => 'spmb_applications',
            'entity_id' => $application->id,
            'after' => ['status' => $status, 'notes' => $notes],
            'ip_address' => request()->ip(),
            'request_id' => request()->header('X-Request-ID'),
        ]);

        return $application->refresh();
    }

    public function convert(SpmbApplication $application): Student
    {
        if ($application->status !== SpmbApplication::STATUS_ACCEPTED) {
            throw new HttpException(422, 'Hanya pendaftar accepted yang bisa dikonversi.');
        }

        return DB::transaction(function () use ($application) {
            $application->refresh();

            if ($application->converted_student_id) {
                return Student::findOrFail($application->converted_student_id);
            }

            $user = User::firstOrCreate(
                ['identifier' => $application->registration_number],
                [
                    'name' => $application->name,
                    'email' => 'spmb-'.Str::lower($application->registration_number).'@sekolah.sch.id',
                    'password' => Hash::make(Str::random(24)),
                    'status' => 'active',
                ]
            );
            $user->assignRole(
                Role::firstOrCreate(['name' => RoleEnum::Siswa->value, 'guard_name' => 'web'])
            );

            $student = Student::firstOrCreate(
                ['nisn' => $application->nisn],
                [
                    'user_id' => $user->id,
                    'name' => $application->name,
                    'gender' => $application->gender,
                    'birth_place' => $application->birth_place,
                    'birth_date' => $application->birth_date,
                    'status' => 'active',
                ]
            );

            // NISN bisa sudah ada (dibuat admin/konversi lain) tanpa user_id:
            // akun siswa yang baru dibuat harus tetap terhubung ke baris siswa itu.
            if ($student->user_id === null) {
                $student->update(['user_id' => $user->id]);
            }

            $application->update(['converted_student_id' => $student->id]);

            return $student;
        });
    }

    /**
     * Urutan per tahun (bukan per gelombang): nomor bertambah monoton dan
     * dipakai lintas gelombang, sehingga bentrok hanya mungkin saat dua submit
     * benar-benar bersamaan — dan itu ditangani retry di persistApplication().
     */
    private function nextRegNumber(SpmbWave $wave): string
    {
        $prefix = 'SPMB-'.now(config('school.timezone', 'Asia/Jakarta'))->format('Y').'-';

        $lastSuffix = SpmbApplication::where('registration_number', 'like', $prefix.'%')
            ->pluck('registration_number')
            ->map(fn (string $number) => (int) substr($number, strlen($prefix)))
            ->max() ?? 0;

        return sprintf('%s%04d', $prefix, $lastSuffix + 1);
    }
}
