<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Book;
use App\Models\Guardian;
use App\Models\KtsToken;
use App\Models\Schedule;
use App\Models\SchoolSetting;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OpsTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_library_borrow_ignores_other_students_id_for_siswa(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = $this->actingAs($admin)->postJson('/api/v1/library/books', [
            'title' => 'Implementing DDD', 'author' => 'V. Vernon', 'physical_stock' => 2,
        ])->assertCreated()->json('data');

        $siswaA = $this->userWithRole(RoleEnum::Siswa->value);
        $studentA = Student::create(['user_id' => $siswaA->id, 'nisn' => '6600000101', 'name' => 'Siswa A']);
        $studentB = Student::create(['nisn' => '6600000102', 'name' => 'Siswa B']);

        // student_id milik siswa lain diabaikan: pinjaman tetap atas nama pemilik akun.
        $loan = $this->actingAs($siswaA)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $studentB->id,
        ])->assertCreated()->json('data');

        $this->assertSame($studentA->id, $loan['student_id']);
        $this->assertDatabaseMissing('book_loans', ['student_id' => $studentB->id]);
    }

    public function test_library_borrow_rejects_siswa_without_linked_student(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = $this->actingAs($admin)->postJson('/api/v1/library/books', [
            'title' => 'Refactoring', 'author' => 'M. Fowler', 'physical_stock' => 1,
        ])->assertCreated()->json('data');

        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $other = Student::create(['nisn' => '6600000201', 'name' => 'Bukan Miliknya']);

        // Tanpa tautan siswa, akun siswa tidak boleh meminjam atas nama siapa pun.
        $this->actingAs($siswa)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $other->id,
        ])->assertStatus(422)->assertJsonPath('errors.code', 'VALIDATION');

        $this->assertDatabaseMissing('book_loans', ['student_id' => $other->id]);
    }

    public function test_library_borrow_return_with_stock_lock(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = $this->actingAs($admin)->postJson('/api/v1/library/books', [
            'title' => 'Clean Architecture', 'author' => 'R. Martin', 'physical_stock' => 1,
        ])->assertCreated()->json('data');

        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $student = Student::create(['user_id' => $siswa->id, 'nisn' => '6600000001', 'name' => 'Peminjam']);

        $loan = $this->actingAs($siswa)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $student->id,
        ])->assertCreated()->json('data');

        // Stok habis → pinjam lagi ditolak; duplikat aktif → konflik.
        $siswa2 = $this->userWithRole(RoleEnum::Siswa->value);
        $student2 = Student::create(['user_id' => $siswa2->id, 'nisn' => '6600000002', 'name' => 'Antre']);
        $this->actingAs($siswa2)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $student2->id,
        ])->assertStatus(422);

        $this->actingAs($admin)->postJson("/api/v1/library/loans/{$loan['id']}/return")
            ->assertOk()->assertJsonPath('data.status', 'returned');

        $this->actingAs($siswa2)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $student2->id,
        ])->assertCreated();
    }

    public function test_schedule_overlap_rejected(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $payload = [
            'day' => 'Senin', 'time_start' => '07:30', 'time_end' => '09:30',
            'kelas' => 'X RPL 1', 'subject_name' => 'Web', 'teacher_name' => 'Pak Budi',
        ];

        $this->actingAs($admin)->postJson('/api/v1/academic/schedules', $payload)->assertCreated();

        // Overlap sebagian → 409; beda kelas → lolos.
        $this->actingAs($admin)->postJson('/api/v1/academic/schedules', [
            ...$payload, 'time_start' => '09:00', 'time_end' => '10:00',
        ])->assertStatus(409);

        $this->actingAs($admin)->postJson('/api/v1/academic/schedules', [
            ...$payload, 'kelas' => 'XI TKJ 1',
        ])->assertCreated();

        $this->assertSame(2, Schedule::count());
    }

    public function test_schedule_update_checks_overlap_and_allows_self(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $base = [
            'day' => 'Selasa', 'time_start' => '07:30', 'time_end' => '09:00',
            'kelas' => 'X RPL 2', 'subject_name' => 'Web', 'teacher_name' => 'Pak Budi',
        ];

        $first = $this->actingAs($admin)->postJson('/api/v1/academic/schedules', $base)
            ->assertCreated()->json('data');
        $second = $this->actingAs($admin)->postJson('/api/v1/academic/schedules', [
            ...$base, 'time_start' => '09:00', 'time_end' => '10:30',
        ])->assertCreated()->json('data');

        // Update menabrak jadwal lain → 409.
        $this->actingAs($admin)->putJson("/api/v1/academic/schedules/{$second['id']}", [
            'time_start' => '08:30', 'time_end' => '10:00',
        ])->assertStatus(409);

        // Update diri sendiri (ruang sama) → lolos; ganti ruangan → 200.
        $this->actingAs($admin)->putJson("/api/v1/academic/schedules/{$second['id']}", ['room' => 'Lab 2'])
            ->assertOk()->assertJsonPath('data.room', 'Lab 2');

        // Siswa tak boleh ubah jadwal.
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $this->actingAs($siswa)->putJson("/api/v1/academic/schedules/{$first['id']}", ['room' => 'X'])
            ->assertForbidden();
    }

    public function test_cms_publish_flow_and_public_access(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);

        $post = $this->actingAs($admin)->postJson('/api/v1/cms/posts', [
            'title' => 'Juara LKS Nasional', 'content' => 'Isi berita...', 'status' => 'draft',
        ])->assertCreated()->json('data');

        // Draft tak terlihat publik.
        $this->getJson('/api/v1/cms/posts')->assertOk()->assertJsonCount(0, 'data.data');

        $this->actingAs($admin)->putJson("/api/v1/cms/posts/{$post['id']}", ['status' => 'published'])
            ->assertOk();

        $this->getJson('/api/v1/cms/posts')->assertOk()->assertJsonCount(1, 'data.data');
        $this->getJson('/api/v1/cms/posts/juara-lks-nasional')->assertOk();

        // Siswa tak boleh kelola CMS.
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $this->actingAs($siswa)->postJson('/api/v1/cms/posts', [
            'title' => 'X', 'content' => 'Y',
        ])->assertForbidden();
    }

    public function test_kts_issue_verify_revoke(): void
    {
        $operator = $this->userWithRole(RoleEnum::Operator->value);
        $student = Student::create(['nisn' => '6600000011', 'name' => 'KTS Kid']);

        $issued = $this->actingAs($operator)->postJson("/api/v1/kts/students/{$student->id}/issue")
            ->assertCreated()->json('data');
        $this->assertNotEmpty($issued['payload']);
        $this->assertNotEmpty($issued['signature']);

        // Verify publik: valid → nisn saja (tanpa data sensitif).
        $ok = $this->postJson('/api/v1/kts/verify', [
            'payload' => $issued['payload'], 'signature' => $issued['signature'],
        ])->assertOk()->assertJsonPath('data.valid', true);
        $this->assertSame('6600000011', $ok->json('data.nisn'));

        // Tanda tangan rusak ditolak.
        $this->postJson('/api/v1/kts/verify', [
            'payload' => $issued['payload'], 'signature' => str_repeat('0', 64),
        ])->assertStatus(422)->assertJsonPath('data.valid', false);

        // Cabut → verify gagal.
        $token = KtsToken::first();
        $this->actingAs($operator)->postJson("/api/v1/kts/tokens/{$token->id}/revoke")->assertOk();
        $this->postJson('/api/v1/kts/verify', [
            'payload' => $issued['payload'], 'signature' => $issued['signature'],
        ])->assertStatus(422);
    }

    public function test_broadcast_logs_per_recipient_with_log_provider(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $parentUser = $this->userWithRole(RoleEnum::OrangTua->value);
        Guardian::create(['user_id' => $parentUser->id, 'name' => 'Ortu B', 'phone' => '081200000009']);

        $res = $this->actingAs($admin)->postJson('/api/v1/broadcasts', [
            'title' => 'Info Libur', 'body' => 'Besok libur.', 'audience' => 'orang_tua',
        ])->assertCreated()
            ->assertJsonPath('data.delivery.total', 1)
            ->assertJsonPath('data.delivery.sent', 1);

        $broadcastId = $res->json('data.broadcast.id');
        $logs = $this->actingAs($admin)->getJson("/api/v1/broadcasts/{$broadcastId}/logs")
            ->assertOk()->json('data.data');
        $this->assertCount(1, $logs);
        $this->assertSame('sent', $logs[0]['status']);

        // Guru tak boleh broadcast.
        $guru = $this->userWithRole(RoleEnum::Guru->value);
        $this->actingAs($guru)->postJson('/api/v1/broadcasts', [
            'title' => 'X', 'body' => 'Y', 'audience' => 'semua',
        ])->assertForbidden();
    }

    public function test_settings_versioned_write_and_secret_masking(): void
    {
        $super = $this->userWithRole(RoleEnum::SuperAdmin->value);
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);

        $this->actingAs($admin)->putJson('/api/v1/settings/school_name', ['value' => 'X'])
            ->assertForbidden();

        $set = $this->actingAs($super)->putJson('/api/v1/settings/school_name', ['value' => 'SMKN 1'])
            ->assertOk()->json('data');
        $this->assertSame(2, $set['version']);

        // Versi basi → konflik.
        $this->actingAs($super)->putJson('/api/v1/settings/school_name', [
            'value' => 'SMKN 2', 'version' => 1,
        ])->assertStatus(409);

        // Secret tak bocor ke non-super-admin.
        SchoolSetting::create(['key' => 'wa_api_key_test', 'value' => 'RAHASIA', 'is_secret' => true]);
        $public = $this->actingAs($admin)->getJson('/api/v1/settings')->assertOk()->json('data');
        $this->assertArrayNotHasKey('wa_api_key_test', $public);

        $full = $this->actingAs($super)->getJson('/api/v1/settings')->assertOk()->json('data');
        $this->assertArrayHasKey('wa_api_key_test', $full);
    }

    public function test_ebook_upload_and_download_authz(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = $this->actingAs($admin)->postJson('/api/v1/library/books', [
            'title' => 'E-Book RPL', 'author' => 'Anon',
            'ebook' => UploadedFile::fake()->create('ebook.pdf', 800, 'application/pdf'),
        ])->assertCreated()->json('data');

        // Katalog menyembunyikan path; unduh butuh login + link bertanda tangan.
        $this->assertArrayNotHasKey('ebook_path', $book);

        $siswa = $this->userWithRole(RoleEnum::Siswa->value);

        // Tanpa signature → ditolak (link tidak bisa dibagikan sembarangan).
        $this->actingAs($siswa)->getJson("/api/v1/library/books/{$book['id']}/ebook")->assertForbidden();

        // Katalog memberi URL bertanda tangan yang bisa langsung dipakai.
        $url = $this->actingAs($siswa)->getJson('/api/v1/library/books')
            ->assertOk()->json('data.data.0.ebook_url');
        $this->assertIsString($url);
        $this->assertStringContainsString('signature=', $url);

        $this->actingAs($siswa)->get($url)->assertOk();
    }

    public function test_library_loans_listing_for_staff(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = $this->actingAs($admin)->postJson('/api/v1/library/books', [
            'title' => 'Refactoring', 'author' => 'M. Fowler', 'physical_stock' => 2,
        ])->assertCreated()->json('data');

        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        $student = Student::create(['user_id' => $siswa->id, 'nisn' => '6600000101', 'name' => 'Peminjam']);

        $loan = $this->actingAs($siswa)->postJson("/api/v1/library/books/{$book['id']}/borrow", [
            'student_id' => $student->id,
        ])->assertCreated()->json('data');

        $rows = $this->actingAs($admin)->getJson('/api/v1/library/loans?status=borrowed')
            ->assertOk()->json('data.data');

        $this->assertCount(1, $rows);
        $this->assertSame($loan['id'], $rows[0]['id']);
        $this->assertSame('Refactoring', $rows[0]['book']['title']);

        // Mahasiswa/guest tidak boleh melihat daftar pinjaman.
        $this->actingAs($siswa)->getJson('/api/v1/library/loans')->assertForbidden();
    }

    public function test_ebook_guest_denied(): void
    {
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);
        $book = Book::create(['title' => 'Tertutup', 'author' => 'Anon', 'ebook_path' => 'x.pdf']);

        $this->getJson("/api/v1/library/books/{$book->id}/ebook")->assertUnauthorized();
    }
}
