<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Book;
use App\Models\Material;
use App\Models\Student;
use App\Models\User;
use App\Support\SignedDownload;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SignedDownloadTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function guru(): User
    {
        return $this->userWithRole(RoleEnum::Guru->value);
    }

    public function test_material_index_exposes_signed_download_url(): void
    {
        Storage::fake('local');
        $guru = $this->guru();

        $res = $this->actingAs($guru)->postJson('/api/v1/lms/materials', [
            'title' => 'Modul 1',
            'file_type' => 'PDF',
            'file' => UploadedFile::fake()->create('modul.pdf', 100, 'application/pdf'),
        ])->assertCreated();

        $materialId = $res->json('data.id');

        $list = $this->actingAs($guru)->getJson('/api/v1/lms/materials')->assertOk();
        $url = $list->json('data.data.0.download_url');

        $this->assertIsString($url);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringContainsString((string) $materialId, $url);
    }

    public function test_material_download_without_signature_is_rejected(): void
    {
        Storage::fake('local');
        $guru = $this->guru();

        $material = Material::create([
            'title' => 'Tanpa Tanda Tangan',
            'file_type' => 'pdf',
            'path' => 'lms/materials/rahasia.pdf',
            'original_name' => 'rahasia.pdf',
        ]);
        Storage::disk('local')->put('lms/materials/rahasia.pdf', 'isi');

        $this->actingAs($guru)
            ->getJson("/api/v1/lms/materials/{$material->id}/download")
            ->assertForbidden();
    }

    public function test_material_download_with_valid_signature_succeeds(): void
    {
        Storage::fake('local');
        $guru = $this->guru();

        $material = Material::create([
            'title' => 'Bertanda Tangan',
            'file_type' => 'pdf',
            'path' => 'lms/materials/modul.pdf',
            'original_name' => 'modul.pdf',
        ]);
        Storage::disk('local')->put('lms/materials/modul.pdf', 'konten materi');

        $url = SignedDownload::url('lms.materials.download', ['material' => $material->id]);

        $this->actingAs($guru)->get($url)->assertOk();
    }

    public function test_expired_signature_is_rejected(): void
    {
        Storage::fake('local');
        $guru = $this->guru();

        $material = Material::create([
            'title' => 'Kedaluwarsa',
            'file_type' => 'pdf',
            'path' => 'lms/materials/lama.pdf',
            'original_name' => 'lama.pdf',
        ]);
        Storage::disk('local')->put('lms/materials/lama.pdf', 'konten');

        $url = URL::temporarySignedRoute(
            'lms.materials.download',
            now()->subMinutes(5),
            ['material' => $material->id]
        );

        $this->actingAs($guru)->getJson($url)->assertForbidden();
    }

    public function test_ebook_requires_signature(): void
    {
        Storage::fake('local');
        $admin = $this->userWithRole(RoleEnum::AdminTu->value);

        $book = Book::create([
            'title' => 'Buku Digital',
            'author' => 'Penulis',
            'ebook_path' => 'library/ebooks/buku.pdf',
            'physical_stock' => 1,
        ]);
        Storage::disk('local')->put('library/ebooks/buku.pdf', 'pdf');

        $this->actingAs($admin)
            ->getJson("/api/v1/library/books/{$book->id}/ebook")
            ->assertForbidden();

        $url = SignedDownload::url('library.ebook', ['book' => $book->id]);
        $this->actingAs($admin)->get($url)->assertOk();
    }

    public function test_signed_url_is_rejected_for_unauthorized_role(): void
    {
        Storage::fake('local');
        // Calon siswa belum bagian komunitas sekolah → tidak boleh baca e-book.
        $calon = $this->userWithRole(RoleEnum::CalonSiswa->value);

        $book = Book::create([
            'title' => 'Buku Terbatas', 'author' => 'X',
            'ebook_path' => 'library/ebooks/x.pdf', 'physical_stock' => 1,
        ]);
        Storage::disk('local')->put('library/ebooks/x.pdf', 'pdf');

        // Bahkan dengan signature valid, otorisasi peran tetap ditegakkan.
        $url = SignedDownload::url('library.ebook', ['book' => $book->id]);

        $this->actingAs($calon)->getJson($url)->assertForbidden();
    }

    public function test_siswa_can_open_ebook_with_valid_signature(): void
    {
        Storage::fake('local');
        $siswa = $this->userWithRole(RoleEnum::Siswa->value);
        Student::create(['user_id' => $siswa->id, 'nisn' => '8800000002', 'name' => 'Pembaca']);

        $book = Book::create([
            'title' => 'Buku Siswa', 'author' => 'Y',
            'ebook_path' => 'library/ebooks/y.pdf', 'physical_stock' => 1,
        ]);
        Storage::disk('local')->put('library/ebooks/y.pdf', 'pdf');

        $url = SignedDownload::url('library.ebook', ['book' => $book->id]);

        $this->actingAs($siswa)->get($url)->assertOk();
    }
}
