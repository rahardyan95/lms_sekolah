<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\AuditLog;
use App\Models\SpmbWave;
use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SettingsConformanceTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function openWave(array $over = []): SpmbWave
    {
        return SpmbWave::create(array_merge([
            'name' => 'Gelombang 1',
            'start_date' => now()->subDay()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
            'quota' => 150, 'fee' => 200000, 'active' => true,
        ], $over));
    }

    /** @return array<string, mixed> */
    private function applicant(string $nisn = '8810000001'): array
    {
        return [
            'name' => 'Calon A', 'nisn' => $nisn, 'gender' => 'L',
            'birth_place' => 'Jakarta', 'birth_date' => '2009-05-12',
            'parent_name' => 'Ortu A', 'parent_phone' => '081200000001',
            'previous_school' => 'SMPN 1', 'average_score' => 89.4,
            'chosen_major' => 'Rekayasa Perangkat Lunak',
        ];
    }

    public function test_key_outside_allowlist_is_rejected(): void
    {
        $super = $this->userWithRole(RoleEnum::SuperAdmin->value);

        $this->actingAs($super)
            ->putJson('/api/v1/settings/not_a_real_key', ['value' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'SETTING_KEY_NOT_ALLOWED');
    }

    public function test_secret_setting_is_encrypted_at_rest_but_readable_through_service(): void
    {
        $super = $this->userWithRole(RoleEnum::SuperAdmin->value);

        $this->actingAs($super)
            ->putJson('/api/v1/settings/wa_api_key', ['value' => 'SUPER-SECRET-TOKEN'])
            ->assertOk();

        $raw = DB::table('school_settings')->where('key', 'wa_api_key')->value('value');

        $this->assertNotSame('SUPER-SECRET-TOKEN', $raw);
        $this->assertStringNotContainsString('SUPER-SECRET-TOKEN', (string) $raw);
        $this->assertSame('SUPER-SECRET-TOKEN', app(SettingsService::class)->value('wa_api_key'));
    }

    public function test_spmb_closed_blocks_public_submit_but_allows_admin_test_mode(): void
    {
        $wave = $this->openWave();
        $super = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $settings = app(SettingsService::class);

        $settings->set('spmb_open', '0', $super);

        // Publik tanpa mode uji: ditolak.
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant())
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'SPMB_CLOSED');

        // Mode uji tanpa peran panitia juga ditolak.
        $settings->set('spmb_test_mode', '1', $super);
        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000002'))
            ->assertStatus(422);

        // Panitia + mode uji: diterima, ditandai [TEST], tercatat di audit log.
        $this->actingAs($super)
            ->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000003'))
            ->assertCreated()
            ->assertJsonPath('data.notes', '[TEST] Pendaftaran mode pengujian admin.');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SPMB_TEST_SUBMIT',
            'actor_id' => $super->id,
        ]);
        $this->assertSame(1, AuditLog::where('action', 'SPMB_TEST_SUBMIT')->count());
    }

    public function test_spmb_open_by_default_when_switch_unset(): void
    {
        $wave = $this->openWave();

        $this->postJson("/api/v1/spmb/waves/{$wave->id}/applications", $this->applicant('8810000004'))
            ->assertCreated();
    }
}
