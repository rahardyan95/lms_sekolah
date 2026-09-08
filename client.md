Daftar Fitur Sistem Website & Management Sekolah (SIAKAD & LMS)
Sistem Informasi Akademik (SIAKAD), Learning Management System (LMS), dan Portal Sekolah Terpadu dikembangkan berbasis Laravel, TailwindCSS, dan AlpineJS dengan dukungan Role-Based Access Control (RBAC).
1. Sistem Autentikasi & Keamanan (Auth & RBAC)
Autentikasi Multi-Role: Mendukung 8 peran akses (Super Admin, Admin/TU, Guru, Bendahara, Operator, Siswa, Orang Tua, Calon Siswa).
Fleksibilitas Login:
Admin, Guru, dan Staff: Login via Email dan Password.
Siswa: Login via NISN dan Password.
Orang Tua: Login instan via NISN dan Tanggal Lahir Siswa (opsional OTP WhatsApp).
Calon Siswa: Login via Akun Pendaftaran SPMB.
Proteksi Rute & Keamanan Sesi: Proteksi berbasis role middleware dengan isolasi sesi antar portal.
Pemulihan Kata Sandi: Fitur lupa password dan reset password terintegrasi.
2. Kartu Tanda Pelajar (KTS) Digital & Generator QR Code
KTS Digital ISO CR-80: Kartu identitas digital ukuran fisik (85.6mm x 54mm) memuat logo sekolah, foto profil, NISN, NIK, nama lengkap, kelas, dan jurusan.
Generator QR Code Vektor SVG: Kode QR presisi tinggi berbasis NISN untuk presensi digital.
KTS Builder & Pengaturan Template: Pengaturan warna header, latar belakang, watermark logo, dan visibilitas elemen kartu.
Modal Preview & Cetak: Pratinjau interaktif dan unduh/cetak KTS dari admin panel, portal siswa, dan portal orang tua.
3. Presensi Harian & Pemindaian QR Code Instant
Pemindaian QR Code Real-Time: Modul presensi (QrAttendanceController) yang mendukung kamera laptop/HP dan barcode scanner USB.
Pencatatan Kehadiran Otomatis: Klasifikasi status presensi (Hadir, Terlambat dengan deteksi waktu masuk, Sakit, Izin, Alpa).
Modal Pop-Up QR Code: Perbesar Kode QR presensi siswa dengan caption NISN.
Rekapitulasi Laporan Presensi: Laporan dan rekap kehadiran harian dan bulanan per kelas dengan filter tanggal.
4. Integrasi WhatsApp Gateway & Notifikasi Otomatis
Multi-Provider WhatsApp Service: Integrasi vendor WhatsApp Gateway (Fonnte, Wablas, Custom API) dengan sakelar pengaktifan instan.
Notifikasi Presensi Real-Time: Pesan notifikasi WhatsApp otomatis ke Nomor Orang Tua saat siswa melakukan pemindaian QR presensi masuk/pulang.
Verifikasi OTP WhatsApp: Kode OTP 6-digit via WhatsApp untuk otentikasi masuk Portal Orang Tua.
WhatsApp Broadcast Manager: Pengiriman pesan pengumuman massal (WaBroadcastController) ke Siswa, Orang Tua, atau Guru beserta log status pengiriman.
5. Portal Orang Tua (Parent Monitoring Portal)
Login Instan: Akses menggunakan kombinasi NISN dan Tanggal Lahir Siswa terdaftar.
Dashboard Monitoring Real-Time (4 Tab Terpadu):
Presensi Kehadiran: Statistik kehadiran (persentase, jumlah hadir, terlambat, izin/sakit, alpa) dan jam masuk harian.
Nilai Akademis: Transkrip perolehan nilai mata pelajaran, rata-rata nilai, nilai tertinggi, jenis ujian (Harian/UTS/UAS), dan catatan guru.
Tagihan SPP & Keuangan: Status pembayaran (Lunas, Cicilan, Belum Lunas), total dibayar, sisa pembayaran, dan Rincian Bulanan (Monthly Breakdown).
Jadwal & Pengumuman: Jadwal KBM hari ini dan pengumuman sekolah.
KTS Digital & Kontak WhatsApp: Akses Kartu Tanda Siswa anak dan tombol kontak langsung via WhatsApp ke sekolah.
6. Portal Siswa Mobile-First & LMS (Learning Management System)
Desain Mobile-First Glassmorphic: Navigasi bawah (Bottom Navigation Bar) khusus smartphone (Beranda, Jadwal, Tugas, Nilai, Profil).
Ringkasan Statistik Siswa: Header statistik NISN, persentase kehadiran, dan rata-rata nilai.
Modul Bahan Ajar (Materials): Akses dan unduh berkas materi (PDF, Word, PPT, Video) yang diunggah guru.
Modul Tugas & Pengumpulan (Assignments): Pengumpulan tugas online, pemantauan tenggat waktu, serta penerimaan nilai dan ulasan guru.
7. Ujian Online CBT (Computer Based Test)
Pengelolaan Ujian CBT: Pembuatan jadwal ujian per kelas, mata pelajaran, dan durasi pengerjaan.
Bank Soal Pilihan Ganda: Soal pilihan ganda (A, B, C, D, E), kunci jawaban, dan bobot nilai.
Ruang Ujian dengan Timer: Hitung mundur otomatis (live countdown timer) dan pengumpulan otomatis saat waktu habis.
Navigasi Soal Interaktif: Indikator status soal (terisi, kosong, ragu-ragu) dan tombol konfirmasi pengumpulan.
Penilaian Otomatis (Auto Grading): Kalkulasi skor dan hasil ujian instan setelah dikumpulkan.
8. Perpustakaan Digital (E-Book & Buku Fisik)
Katalog Perpustakaan Terpadu: Data buku (judul, pengarang, penerbit, ISBN, tahun terbit, stok fisik, dan kategori).
Pembaca E-Book PDF Terintegrasi: Membaca buku digital langsung di browser tanpa perlu mengunduh berkas.
Pencarian & Filter Koleksi: Pencarian berdasarkan judul, pengarang, dan kategori buku.
Informasi Stok Fisik: Pemantauan jumlah buku fisik untuk peminjaman di perpustakaan.
9. Manajemen Keuangan Sekolah & SPP Bulanan
Master Pos Pembayaran: Pengaturan jenis biaya (SPP Bulanan, Uang Gedung, Seragam, Ujian, Kegiatan, dll).
Distribusi Tagihan Otomatis: Pembagian tagihan ke seluruh siswa per kelas atau angkatan.
Manajemen SPP Bulanan: Pencatatan SPP 12 bulan per siswa (Lunas, Cicilan/Sebagian, Belum Lunas).
Transaksi Arus Kas: Pencatatan pemasukan (Income) dan pengeluaran (Expense) operasional sekolah.
Manajemen Rekening Bank: Data rekening bank sekolah untuk penerimaan pembayaran transfer.
Cetak Kwitansi & Laporan Keuangan: Cetak kwitansi pembayaran serta laporan neraca dan arus kas bulanan/tahunan.
10. Penerimaan Murid Baru (SPMB / PPDB Online)
Manajemen Gelombang Pendaftaran: Kuota pendaftar, tanggal buka/tutup, dan biaya pendaftaran.
Status Bar Kuota Visual: Persentase kuota terisi dan sisa kursi per gelombang.
Formulir Pendaftaran Multi-Step: Pendaftaran online (akun, data diri, data orang tua, sekolah asal, dan upload berkas).
Verifikasi Berkas Admin: Seleksi pendaftar oleh admin (Draft, Verified, Accepted, Rejected + Catatan).
Konversi Akun Otomatis: Pendaftar berstatus Accepted otomatis menjadi akun Siswa aktif dan masuk kelas.
Cetak Bukti Pendaftaran: Cetak bukti pendaftaran resmi SPMB.
11. Manajemen Akademik & Pengumuman
Tahun Akademik, Kelas & Jurusan: Pengelolaan tahun pelajaran aktif, kelas, dan jurusan/program keahlian (SD, SMP, SMA, SMK).
Manajemen Jadwal Pelajaran: Pengaturan jadwal KBM (hari, jam mulai/selesai, ruangan, mata pelajaran, guru pengampu).
Entri Nilai Massal (Bulk Grading): Pengisian nilai sekaligus untuk seluruh siswa dalam satu kelas.
Publikasi Pengumuman: Penerbitan pengumuman internal sekolah.
12. Content Management System (CMS), Berita & Galeri
Website Utama Modern: Landing page sekolah responsif dan teroptimasi SEO.
Hero Banner Slider: Pengelolaan banner promosi dan kegiatan di halaman utama.
Modul Berita & Blog SEO: Artikel berita sekolah dengan Kategori, Tag, Gambar Sampul, dan URL ramah SEO.
Galeri Dokumentasi: Album foto kegiatan dan fasilitas sekolah.
Informasi Profil Sekolah: Visi Misi, Sejarah, Sambutan Kepala Sekolah, Program Keahlian, Agenda Kegiatan, Google Maps, dan Media Sosial.
13. Pengaturan Sistem & Integrasi Gateway
Identitas Sekolah: Nama Sekolah, NPSN, Alamat, Telepon, Email, Logo Sekolah, dan Favicon.
Konfigurasi WhatsApp Gateway: Provider WA, API Key, URL Endpoint, serta sakelar notifikasi presensi dan OTP.
Konfigurasi Email SMTP: Server SMTP mailer untuk notifikasi sistem.
Pengaturan Mode SPMB: Sakelar buka/tutup pendaftaran SPMB dan Mode Pengujian Admin.