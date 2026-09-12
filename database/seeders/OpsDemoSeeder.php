<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Book;
use App\Models\PaymentItem;
use App\Models\Post;
use App\Models\Student;
use App\Services\FinanceService;
use Illuminate\Database\Seeder;

/** Data demo modul operasi (non-production) untuk verifikasi end-to-end. */
class OpsDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        Book::firstOrCreate(
            ['isbn' => '978-0134494166'],
            [
                'title' => 'Clean Architecture', 'author' => 'Robert C. Martin',
                'publisher' => 'Prentice Hall', 'year' => 2022,
                'category' => 'Teknologi & RPL', 'physical_stock' => 12,
                'page_count' => 432, 'summary' => 'Prinsip SOLID dan arsitektur modular.',
            ]
        );

        Book::firstOrCreate(
            ['isbn' => '978-6026232540'],
            [
                'title' => 'Jaringan Komputer Berbasis Mikrotik', 'author' => 'Iwan Sofana',
                'publisher' => 'Informatika Bandung', 'year' => 2023,
                'category' => 'Teknik Komputer & Jaringan', 'physical_stock' => 18,
                'page_count' => 380, 'summary' => 'Routing OSPF, VLAN, firewall, VPN.',
            ]
        );

        Announcement::firstOrCreate(
            ['title' => 'PTS Ganjil Berbasis CBT 14 September 2026'],
            [
                'content' => 'PTS Ganjil diselenggarakan berbasis CBT Online. Pastikan akun portal aktif.',
                'target_role' => 'Semua', 'is_important' => true, 'published' => true,
            ]
        );

        Post::firstOrCreate(
            ['slug' => 'juara-umum-lks-nasional-2026'],
            [
                'title' => 'Juara Umum LKS Nasional 2026 Bidang Web Technologies',
                'category' => 'Prestasi Sekolah',
                'excerpt' => 'Delegasi siswa menyabet 2 Medali Emas LKS Nasional di Surabaya.',
                'content' => 'Prestasi gemilang kembali ditorehkan siswa SMK Negeri 1 Jakarta pada LKS Nasional XXXIV.',
                'tags' => ['LKS 2026', 'Prestasi'],
                'status' => 'published',
                'published_at' => now(),
            ]
        );

        $item = PaymentItem::firstOrCreate(
            ['name' => 'SPP Bulanan', 'category' => 'SPP'],
            ['amount' => 500000, 'academic_year' => '2026/2027', 'active' => true]
        );

        $student = Student::where('nisn', '0071829384')->first();
        if ($student) {
            app(FinanceService::class)->distribute(
                $item, [$student->id], now()->format('Y-m'), now()->addDays(7)->format('Y-m-d')
            );
        }

        $this->command?->info('OpsDemoSeeder: buku, pengumuman, berita, tagihan demo siap.');
    }
}
