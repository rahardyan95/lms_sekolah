<?php

namespace Tests\Feature;

use App\Contracts\WhatsappGatewayInterface;
use App\Enums\RoleEnum;
use App\Models\Broadcast;
use App\Models\Guardian;
use App\Models\NotificationLog;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BroadcastDeliveryTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    /** Rekam nomor tujuan yang benar-benar dikirim ke gateway. */
    private function fakeGateway(array &$sentTo): void
    {
        $gateway = \Mockery::mock(WhatsappGatewayInterface::class);
        $gateway->shouldReceive('sendMessage')->andReturnUsing(function (string $to, string $message) use (&$sentTo) {
            $sentTo[] = $to;

            return ['status' => 'sent', 'provider' => 'fake'];
        });
        $this->app->instance(WhatsappGatewayInterface::class, $gateway);
    }

    public function test_siswa_broadcast_goes_to_guardian_phone(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        $student = Student::create(['nisn' => '5550001111', 'name' => 'Anak Satu', 'status' => 'active']);
        $guardian = Guardian::create(['name' => 'Wali Satu', 'phone' => '081200000001', 'status' => 'active']);
        $student->guardians()->attach($guardian->id);

        $res = $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'Libur',
            'body' => 'Sekolah libur besok.',
            'audience' => 'siswa',
        ])->assertCreated();

        $this->assertSame(['081200000001'], $sentTo);
        $res->assertJsonPath('data.delivery.total', 1)
            ->assertJsonPath('data.delivery.sent', 1)
            ->assertJsonPath('data.broadcast.status', 'sent');
    }

    public function test_siswa_without_guardian_phone_is_not_falsely_marked_sent(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        $student = Student::create(['nisn' => '5550002222', 'name' => 'Anak Tanpa Wali', 'status' => 'active']);
        $guardian = Guardian::create(['name' => 'Wali Tanpa Nomor', 'phone' => null, 'status' => 'active']);
        $student->guardians()->attach($guardian->id);

        $res = $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'Libur', 'body' => 'Pesan.', 'audience' => 'siswa',
        ])->assertCreated();

        $this->assertSame([], $sentTo);
        $res->assertJsonPath('data.delivery.total', 0)
            ->assertJsonPath('data.broadcast.status', 'failed')
            ->assertJsonPath('data.message', 'Tidak ada penerima dengan nomor WhatsApp yang valid untuk audiens ini.');
    }

    public function test_guru_broadcast_uses_user_phone_and_reports_no_recipients_honestly(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        $guruWithPhone = $this->userWithRole(RoleEnum::Guru->value);
        $guruWithPhone->update(['phone' => '081200000009']);
        $this->userWithRole(RoleEnum::Guru->value); // guru tanpa nomor

        $res = $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'Rapat', 'body' => 'Rapat besok.', 'audience' => 'guru',
        ])->assertCreated();

        $this->assertSame(['081200000009'], $sentTo);
        $res->assertJsonPath('data.delivery.total', 1)->assertJsonPath('data.delivery.sent', 1);
    }

    public function test_partial_delivery_marks_status_partial(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $calls = 0;
        $gateway = \Mockery::mock(WhatsappGatewayInterface::class);
        $gateway->shouldReceive('sendMessage')->andReturnUsing(function () use (&$calls) {
            $calls++;

            return $calls === 1 ? ['status' => 'sent'] : ['status' => 'failed'];
        });
        $this->app->instance(WhatsappGatewayInterface::class, $gateway);

        foreach (['081200000031', '081200000032'] as $phone) {
            Guardian::create(['name' => 'Wali '.$phone, 'phone' => $phone, 'status' => 'active']);
        }

        $res = $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'orang_tua',
        ])->assertCreated();

        $res->assertJsonPath('data.delivery.sent', 1)
            ->assertJsonPath('data.delivery.failed', 1)
            ->assertJsonPath('data.broadcast.status', 'partial');
    }

    public function test_invalid_phone_length_is_skipped(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        Guardian::create(['name' => 'Wali Nomor Pendek', 'phone' => '123', 'status' => 'active']);

        $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'orang_tua',
        ])->assertCreated()->assertJsonPath('data.delivery.total', 0);

        $this->assertSame([], $sentTo);
        $this->assertSame('failed', Broadcast::firstOrFail()->status);
    }

    public function test_semua_audience_reaches_students_guardians_and_teachers_once_each(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        // Guru dengan nomor.
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $guru->update(['phone' => '081200000101']);

        // Wali yang juga wali dari seorang siswa → nomornya tidak boleh ganda.
        $guardian = Guardian::create(['name' => 'Wali Gabungan', 'phone' => '081200000102', 'status' => 'active']);
        $student = Student::create(['nisn' => '5550003333', 'name' => 'Anak Gabungan', 'status' => 'active']);
        $student->guardians()->attach($guardian->id);

        $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'Pengumuman', 'body' => 'Untuk semua.', 'audience' => 'semua',
        ])->assertCreated()->assertJsonPath('data.delivery.total', 2);

        sort($sentTo);
        $this->assertSame(['081200000101', '081200000102'], $sentTo);
    }

    public function test_notification_log_reaches_sent_and_records_failure_with_attempts(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);

        // Skenario sukses.
        $sentTo = [];
        $this->fakeGateway($sentTo);
        Guardian::create(['name' => 'Wali Sukses', 'phone' => '081200000201', 'status' => 'active']);
        $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'orang_tua',
        ])->assertCreated();

        $sent = NotificationLog::where('recipient', '081200000201')->firstOrFail();
        $this->assertSame('sent', $sent->status);
        $this->assertSame(1, $sent->attempts);

        // Skenario gagal: gateway melempar → baris log menjadi failed.
        $failing = \Mockery::mock(WhatsappGatewayInterface::class);
        $failing->shouldReceive('sendMessage')->andThrow(new \RuntimeException('gateway down'));
        $this->app->instance(WhatsappGatewayInterface::class, $failing);

        Guardian::create(['name' => 'Wali Gagal', 'phone' => '081200000202', 'status' => 'active']);
        $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'orang_tua',
        ])->assertCreated();

        $failed = NotificationLog::where('recipient', '081200000202')->firstOrFail();
        $this->assertSame('failed', $failed->status);
        $this->assertGreaterThanOrEqual(1, $failed->attempts);
        $this->assertNotNull($failed->last_error);
    }

    public function test_notification_retry_redispatches_the_matching_job(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $sentTo = [];
        $this->fakeGateway($sentTo);

        Guardian::create(['name' => 'Wali Retry', 'phone' => '081200000301', 'status' => 'active']);
        $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'orang_tua',
        ])->assertCreated();

        $log = NotificationLog::where('recipient', '081200000301')->firstOrFail();
        $attemptsBefore = count($sentTo);

        $this->actingAs($admin)->postJson("/api/v1/notifications/{$log->id}/retry")->assertOk();

        $this->assertGreaterThan($attemptsBefore, count($sentTo));
    }
}
