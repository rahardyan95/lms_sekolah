# Business Requirements Document (BRD)
## SIAKAD, LMS, dan Portal Sekolah Terpadu

| Atribut | Nilai |
|---|---|
| Versi | 1.0 |
| Status | Draft untuk review stakeholder |
| Tanggal | 8 September 2026 |
| Pemilik bisnis | Yayasan/Kepala Sekolah |
| Sumber utama | [`client.md`](../client.md) |
| Dokumen terkait | [`PRD.md`](./PRD.md), [`FRD.md`](./FRD.md) |

> BRD ini mendefinisikan alasan bisnis, outcome, ruang lingkup, dan kriteria keberhasilan. Detail perilaku produk berada di PRD; detail implementasi berada di FRD.

---

## 1. Ringkasan Eksekutif

Sekolah membutuhkan satu platform terpadu untuk mengelola data akademik, pembelajaran, presensi, ujian, keuangan, penerimaan murid baru, komunikasi, dan website publik. Saat ini proses tersebut berisiko tersebar pada spreadsheet, aplikasi terpisah, komunikasi manual, dan arsip fisik sehingga data terlambat, sulit diaudit, dan pengalaman siswa/orang tua tidak konsisten.

Solusi yang ditetapkan adalah platform web mobile-first berbasis SIAKAD, LMS, portal orang tua, portal SPMB, dan CMS sekolah. Sistem harus memiliki delapan role akses, data terpusat, audit trail, integrasi WhatsApp/email, notifikasi real-time untuk proses penting, serta kontrol keamanan dan backup yang memadai.

Keberhasilan bisnis tidak diukur dari banyaknya screen, tetapi dari proses yang benar-benar tersimpan, dapat diaudit, dapat dipakai oleh role yang tepat, dan menghasilkan pengurangan pekerjaan manual.

## 2. Latar Belakang dan Masalah Bisnis

### 2.1 Masalah utama

1. Data siswa, orang tua, akademik, kehadiran, tugas, pembayaran, dan pendaftaran tidak memiliki sumber kebenaran terpusat.
2. Presensi dan notifikasi orang tua masih membutuhkan input serta follow-up manual.
3. Guru dan siswa membutuhkan satu alur LMS untuk materi, tugas, nilai, dan ujian.
4. Rekap nilai, SPP, arus kas, dan laporan administratif rentan terlambat atau tidak konsisten.
5. Pendaftaran murid baru dan verifikasi berkas membutuhkan pelacakan status yang jelas.
6. Website publik dan konten sekolah sulit dikelola tanpa perubahan kode.
7. Akses data sensitif memerlukan pembatasan role, audit trail, backup, dan kebijakan retensi.

### 2.2 Dampak bisnis

- Waktu kerja administrasi meningkat.
- Orang tua terlambat menerima informasi kehadiran dan akademik.
- Risiko kesalahan input, duplikasi data, dan kehilangan arsip meningkat.
- Sekolah sulit mengukur performa operasional secara konsisten.
- Pengalaman digital siswa, guru, dan calon siswa tidak seragam.

## 3. Tujuan Bisnis dan Outcome

| ID | Tujuan | Outcome yang diharapkan | Indikator awal |
|---|---|---|---|
| BO-001 | Memusatkan data operasional sekolah | Satu sumber data akademik dan administratif | ≥95% data aktif dikelola melalui sistem |
| BO-002 | Mengurangi pekerjaan manual | Presensi, rekap, tagihan, dan laporan lebih otomatis | Beban administrasi manual turun ≥50% |
| BO-003 | Meningkatkan keterlibatan orang tua | Orang tua memperoleh data anak secara cepat dan aman | ≥60% akun orang tua aktif bulanan |
| BO-004 | Mendukung pembelajaran digital | Materi, tugas, nilai, dan CBT tersedia dalam satu portal | ≥70% tugas dikumpulkan online |
| BO-005 | Mempercepat komunikasi | Notifikasi presensi dan pengumuman terdokumentasi | ≥95% notifikasi presensi terkirim <15 detik |
| BO-006 | Meningkatkan akuntabilitas keuangan | Transaksi, kwitansi, dan laporan dapat ditelusuri | 100% transaksi memiliki pencatat dan bukti |
| BO-007 | Meningkatkan konversi SPMB | Pendaftaran, verifikasi, dan konversi siswa terkontrol | 100% status pendaftar dapat dilacak |
| BO-008 | Menjaga keamanan dan kontinuitas layanan | Data terlindungi, diaudit, dan dapat dipulihkan | Uptime ≥99,5%; backup berhasil 100% |

## 4. Sasaran Pengguna dan Stakeholder

| Stakeholder/role | Kepentingan | Tanggung jawab bisnis | Kebutuhan utama |
|---|---|---|---|
| Yayasan/Kepala Sekolah | Transparansi dan kontrol | Menyetujui kebijakan, KPI, dan laporan | Dashboard, laporan, audit, website |
| Super Admin | Governance sistem | Mengelola role, konfigurasi, integrasi, audit | Akses penuh terkontrol |
| Admin/TU | Operasional data | Mengelola siswa, kelas, akademik, SPMB | CRUD, import, laporan, pengumuman |
| Guru | Pembelajaran | Mengelola jadwal, materi, tugas, nilai, ujian | LMS, bulk grading, CBT |
| Bendahara | Keuangan | Mengelola tagihan, transaksi, bank, kwitansi | SPP, kas, laporan |
| Operator | Operasional teknis | Menjalankan presensi dan operasional SPMB | QR scan, status, notifikasi |
| Siswa | Pembelajaran | Mengikuti kelas, tugas, ujian, membaca nilai | Portal mobile-first, LMS, CBT |
| Orang Tua | Monitoring anak | Memantau presensi, nilai, SPP, pengumuman | Portal aman dan realtime |
| Calon Siswa | Pendaftaran | Mengisi dan melanjutkan pendaftaran | SPMB multi-step, upload, status |
| Tim IT/QA | Delivery dan reliability | Membangun, menguji, memonitor, memulihkan | FRD, test evidence, observability |

## 5. Visi Solusi

“Memberikan satu ekosistem digital sekolah yang aman, mudah digunakan, mobile-first, dan dapat diaudit untuk mempercepat operasional sekolah serta meningkatkan kualitas pengalaman belajar dan komunikasi keluarga.”

## 6. Capability Map

| Capability | Modul | Nilai bisnis |
|---|---|---|
| Identity & access | Auth, RBAC, session, audit | Data hanya diakses pihak berwenang |
| Student information | Siswa, orang tua, kelas, jurusan, tahun ajaran | Data induk konsisten |
| Academic operations | Jadwal, nilai, pengumuman | Operasional akademik terukur |
| Attendance | QR/barcode, rekap, notifikasi | Kehadiran tercatat dan cepat diketahui |
| Digital learning | Materi, tugas, submission, nilai | Proses belajar terdokumentasi |
| Assessment | CBT, bank soal, timer, grading | Ujian lebih efisien dan adil |
| Library | Katalog, stok, PDF reader, pencarian | Akses sumber belajar meningkat |
| Finance | SPP, kas, bank, kwitansi, laporan | Akuntabilitas keuangan |
| Admissions | Gelombang, formulir, berkas, seleksi | Penerimaan murid terlacak |
| Communication | WhatsApp, email, broadcast, announcement | Informasi tersampaikan dan diaudit |
| Public presence | CMS, news, gallery, profile, SEO | Website publik dapat dikelola |
| Reporting & governance | Dashboard, export, audit, backup | Keputusan berbasis data |

## 7. Ruang Lingkup

### 7.1 In scope

1. Autentikasi delapan role dan kontrol akses berbasis role.
2. Data induk siswa, orang tua, guru, kelas, jurusan, mapel, dan tahun ajaran.
3. KTS digital ISO CR-80 dan QR berbasis NISN.
4. Presensi QR/kamera/barcode, klasifikasi status, rekap, dan notifikasi.
5. Integrasi WhatsApp multi-provider, OTP, broadcast, dan delivery log.
6. Portal orang tua dengan empat tab monitoring.
7. Portal siswa mobile-first, materi, tugas, submission, nilai, dan profil.
8. CBT dengan jadwal, bank soal, timer tersinkron, autosave, auto-submit, dan grading.
9. Perpustakaan buku fisik dan e-book PDF.
10. Keuangan SPP, tagihan, transaksi, rekening, kwitansi, dan laporan.
11. SPMB multi-step, upload berkas, verifikasi, status, konversi akun, dan bukti pendaftaran.
12. Manajemen akademik, jadwal, bulk grading, dan pengumuman internal.
13. CMS website publik, berita, galeri, profil, agenda, maps, dan sosial media.
14. Pengaturan identitas sekolah, gateway, SMTP, SPMB, keamanan, backup, monitoring, dan CI/CD.

### 7.2 Out of scope versi rilis pertama

- Payroll dan HR lengkap untuk pegawai.
- Akuntansi double-entry penuh atau integrasi ERP.
- Payment gateway otomatis tanpa keputusan provider dan settlement sekolah.
- Video conference/live teaching.
- Marketplace atau penjualan produk sekolah.
- Native Android/iOS terpisah; portal web responsif/PWA menjadi target awal.
- Integrasi Dapodik/Rapor Digital nasional sebelum kontrak dan format resmi disepakati.
- Facial recognition atau biometrik presensi.
- AI untuk penilaian atau rekomendasi akademik.

Out-of-scope dapat menjadi change request dengan analisis dampak, prioritas, dan persetujuan pemilik bisnis.

## 8. Kebutuhan Bisnis Tingkat Tinggi

| ID | Kebutuhan bisnis | Prioritas | Pemilik | Kriteria bisnis |
|---|---|---|---|---|
| BR-001 | Sistem harus membedakan akses delapan role | P0 | Super Admin | Role tidak dapat membaca/menulis data di luar kewenangannya |
| BR-002 | Data induk siswa dan relasi orang tua harus terpusat | P0 | Admin/TU | Satu siswa tidak memiliki identitas duplikat tanpa proses merge |
| BR-003 | Presensi harus tercatat dari QR/barcode dan dapat direkap | P0 | Operator | Rekap harian/bulanan dapat difilter kelas dan tanggal |
| BR-004 | Orang tua harus menerima informasi presensi dan monitoring anak | P0 | Kepala Sekolah | Data hanya menampilkan anak yang terhubung |
| BR-005 | Guru dan siswa harus memiliki alur LMS | P0 | Wakil Kurikulum | Materi, tugas, submission, nilai, dan ulasan memiliki status jelas |
| BR-006 | Ujian digital harus adil dan dapat diaudit | P0 | Guru/QA | Jadwal, timer, jawaban, submit, dan hasil memiliki timestamp |
| BR-007 | Keuangan harus dapat ditelusuri sampai transaksi/bukti | P0 | Bendahara | Setiap perubahan kritis masuk audit log |
| BR-008 | Pendaftaran murid baru harus dapat dilanjutkan dan diverifikasi | P0 | Panitia SPMB | Status dan catatan seleksi terlihat sesuai role |
| BR-009 | Pengumuman internal dan notifikasi eksternal harus terdokumentasi | P0 | Admin | Delivery status dapat diaudit dan gagal dapat ditindaklanjuti |
| BR-010 | Website publik harus dapat dikelola tanpa deploy kode | P0 | Admin/CMS | Konten publish/unpublish memiliki author dan timestamp |
| BR-011 | Sistem harus aman dan dapat dipulihkan | P0 | Super Admin/IT | Backup, restore drill, rate limit, encryption, dan audit tersedia |
| BR-012 | Sistem harus nyaman di smartphone dan desktop | P0 | Product/UX | Alur utama lolos uji 375px, 480px, 768px, 1024px, 1440px |

## 9. Proses Bisnis Target

### 9.1 Identitas dan akses

1. Super Admin membuat role/permission melalui konfigurasi yang dikendalikan.
2. Pengguna login melalui metode sesuai role.
3. Sistem memvalidasi kredensial, rate limit, status akun, dan guard.
4. Sistem membuat session terisolasi, mencatat audit login, dan mengarahkan ke portal sesuai role.
5. Logout, timeout 30 menit tidak aktif, reset password, dan revoke session tersedia.

### 9.2 Presensi dan notifikasi

1. Operator/Guru membuka scanner dan memilih lokasi/sesi.
2. QR/barcode NISN dipindai; sistem memvalidasi siswa dan duplikasi hari itu.
3. Sistem menentukan status berdasarkan konfigurasi jam masuk dan zona waktu sekolah.
4. Attendance disimpan secara atomik beserta device/operator/timestamp.
5. Event notifikasi dikirim melalui queue ke provider WhatsApp aktif.
6. Delivery status disimpan; kegagalan masuk retry/dead-letter dan terlihat di log.

### 9.3 Pembelajaran dan ujian

1. Guru membuat materi, tugas, rubrik, jadwal ujian, dan bank soal.
2. Siswa hanya melihat kelas dan materi yang menjadi targetnya.
3. Siswa mengunduh/membaca materi atau mengunggah submission sebelum deadline.
4. CBT hanya dapat dimulai pada window jadwal; timer memakai waktu server.
5. Jawaban di-autosave, ujian auto-submit saat timeout, hasil dihitung dan disimpan.
6. Guru dapat memberi nilai/feedback; siswa melihat status sesuai kebijakan publikasi.

### 9.4 Keuangan

1. Bendahara membuat pos biaya dan aturan tagihan.
2. Sistem mendistribusikan invoice ke siswa target berdasarkan kelas/angkatan.
3. Pembayaran dicatat dengan metode dan referensi; cicilan/lunas dihitung konsisten.
4. Sistem menerbitkan nomor kwitansi unik dan menyediakan cetak/PDF.
5. Transaksi kas dan rekening direkonsiliasi; laporan periode dapat diekspor.

### 9.5 SPMB

1. Admin membuat gelombang, kuota, jadwal, biaya, dan persyaratan.
2. Calon siswa membuat akun dan mengisi formulir multi-step.
3. Draft tersimpan sehingga dapat dilanjutkan; file diverifikasi tipe/ukuran.
4. Panitia memberi status dan catatan; perubahan status masuk audit.
5. Status Accepted memicu pembuatan akun siswa dan penempatan kelas melalui workflow idempotent.
6. Bukti pendaftaran dapat dicetak oleh pihak yang berwenang.

## 10. KPI dan Pengukuran

| KPI | Target | Sumber data | Owner | Frekuensi |
|---|---:|---|---|---|
| Presensi via QR | ≥90% siswa aktif | Attendance report | Operator | Harian |
| Notifikasi presensi <15 detik | ≥95% terkirim | Delivery log | IT/Admin | Harian |
| Aktivasi orang tua | ≥60% bulanan | Auth/portal analytics | Admin | Bulanan |
| Tugas dikumpulkan online | ≥70% | Submission report | Wakil Kurikulum | Bulanan |
| Pengurangan proses manual | ≥50% | Survey/time study | Kepala TU | Per kuartal |
| Kepuasan pengguna | ≥4,0/5 | Survey UAT/production | Product | Per semester |
| Uptime | ≥99,5% | Monitoring | IT | Bulanan |
| P95 API | ≤500 ms | APM/access log | IT | Harian |
| Lighthouse SEO publik | ≥90 | CI/Lighthouse | CMS owner | Setiap release |
| Backup berhasil | 100% job wajib | Backup monitor | IT | Harian |
| Test coverage backend | ≥80% | CI | Engineering | Setiap release |

Definisi pengukuran, percentile, timezone, periode, dan pengecualian outage harus mengikuti FRD dan runbook operasional.

## 11. Asumsi, Constraint, dan Dependency

### 11.1 Asumsi

- Sekolah memiliki domain dan server minimal VPS 4 GB RAM atau layanan setara.
- Data NISN, NIK, kelas, dan relasi orang tua tersedia serta dapat divalidasi.
- Nomor telepon orang tua memiliki format yang dapat digunakan provider WhatsApp.
- Foto siswa dan konten sekolah tersedia dengan izin penggunaan.
- Operator memiliki perangkat kamera/barcode dan koneksi internet stabil.
- Tim memiliki akses Docker, repository, credential provider, dan domain/SMTP.

### 11.2 Constraint

- Data sensitif siswa, NIK, telepon, nilai, dan transaksi harus mengikuti kebijakan privasi sekolah.
- WhatsApp provider dapat mengalami rate limit, downtime, atau perubahan API.
- Kualitas kamera dan bandwidth perangkat siswa/operator bervariasi.
- Target PWA/offline dibatasi pada asset dan data yang aman dicache; transaksi kritis tetap memerlukan koneksi.
- Perubahan struktur data akademik harus menjaga histori tahun ajaran.

### 11.3 Dependency

Laravel 13/PHP 8.4, Livewire 3, TailwindCSS 4, AlpineJS 3, PostgreSQL 17, Redis 7, Reverb, Horizon, Meilisearch, object storage, SMTP, WhatsApp provider, DomPDF, PDF.js, QR generator, Google Maps, Docker, CI/CD, dan monitoring.

## 12. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi | Owner |
|---|---|---|---|
| Downtime/kontrak WhatsApp provider | Notifikasi tertunda | Multi-provider, queue, retry, provider health check, manual resend | IT |
| Ujian massal membebani sistem | CBT gagal/terlambat | Load test, autosave terukur, queue grading, capacity plan | Engineering |
| Kebocoran data siswa/keuangan | Dampak hukum/reputasi | RBAC, encryption, masking, audit, CSP, rate limit, least privilege | Security/IT |
| Data awal tidak bersih | Laporan salah | Import staging, validation, duplicate detection, approval | Admin/TU |
| Kamera tidak kompatibel | Presensi lambat | Barcode fallback, manual entry terotorisasi, device matrix test | Operator |
| Konten CMS tidak terkelola | Website usang | Ownership editorial, workflow draft/review/publish, reminder | CMS owner |
| Backup tidak dapat dipulihkan | Kehilangan data | Restore drill berkala, checksum, offsite backup, RPO/RTO test | IT |
| Scope melebar | Jadwal dan biaya meningkat | P0/P1/P2, change request, product council | Product |

## 13. Governance dan Acceptance

### 13.1 Decision maker

- Business owner: Yayasan/Kepala Sekolah.
- Product owner: perwakilan manajemen sekolah.
- Technical owner: lead engineering/IT.
- Quality owner: QA lead.
- Domain approver: Admin/TU, Guru, Bendahara, Operator, dan panitia SPMB sesuai modul.

### 13.2 Definition of Ready

Requirement dapat masuk development jika memiliki ID, tujuan, role, scope, acceptance criteria, dependency, data owner, dan keputusan security/privacy.

### 13.3 Definition of Done

Fitur dianggap selesai jika implementasi, migration, authorization, loading/error/empty state, accessibility dasar, audit/notification yang diwajibkan, automated test, UAT evidence, dokumentasi, dan monitoring hook telah tersedia.

### 13.4 UAT gate

UAT harus mencakup alur happy path, unauthorized access, invalid input, duplicate/retry, timeout/offline, mobile widths, keyboard/screen reader smoke test, dan export/print/download. Sign-off diberikan oleh domain approver dan product owner.

## 14. Traceability

| Sumber `client.md` | Business requirement | PRD epic | FRD section |
|---|---|---|---|
| Bagian 1 Auth & Security | BR-001, BR-011 | AUTH | FRD 5, 8, 15 |
| Bagian 2 KTS | BR-002 | KTS | FRD 6 |
| Bagian 3 Presensi | BR-003, BR-004 | ATT | FRD 7, 12 |
| Bagian 4 WhatsApp | BR-005, BR-009 | WA | FRD 8, 13 |
| Bagian 5 Parent Portal | BR-004 | PRT | FRD 9 |
| Bagian 6 LMS | BR-005, BR-012 | LMS | FRD 10 |
| Bagian 7 CBT | BR-006 | CBT | FRD 11 |
| Bagian 8 Library | BR-005 | LIB | FRD 12 |
| Bagian 9 Finance | BR-006, BR-007 | FIN | FRD 13 |
| Bagian 10 SPMB | BR-008 | SPMB | FRD 14 |
| Bagian 11 Academic | BR-002, BR-005 | ACD | FRD 9, 10 |
| Bagian 12 CMS | BR-010 | CMS | FRD 15 |
| Bagian 13 Settings | BR-001, BR-011 | SYS | FRD 5, 15 |

## 15. Perubahan dan Open Decisions

| ID | Keputusan yang diperlukan | Default sementara | Decision owner | Status |
|---|---|---|---|---|
| DEC-001 | Provider WhatsApp primary dan fallback | Fonnte/Wablas adapter | Super Admin | TBD |
| DEC-002 | Payment method dan rekonsiliasi bank | Manual verification + reference number | Bendahara | TBD |
| DEC-003 | Kebijakan publikasi nilai | Guru submit, wali kelas/admin publish | Wakil Kurikulum | TBD |
| DEC-004 | Retensi data lulusan dan dokumen | Minimum mengikuti kebijakan sekolah/hukum | Kepala Sekolah | TBD |
| DEC-005 | Offline PWA yang diizinkan | Read-only static shell; no critical mutation offline | IT/Product | TBD |
| DEC-006 | Format import legacy | CSV/XLSX template versioned | Admin/TU | TBD |
| DEC-007 | SLA support dan incident severity | P1 critical, P2 major, P3 minor | IT/Product | TBD |

Perubahan terhadap kebutuhan yang telah disetujui wajib memiliki alasan, dampak terhadap scope/data/security, prioritas baru, dan persetujuan product owner.

## 16. Glosarium

| Istilah | Definisi |
|---|---|
| SIAKAD | Sistem Informasi Akademik |
| LMS | Learning Management System |
| RBAC | Role-Based Access Control |
| KTS | Kartu Tanda Siswa |
| NISN | Nomor Induk Siswa Nasional |
| NIK | Nomor Induk Kependudukan |
| NPSN | Nomor Pokok Sekolah Nasional |
| CBT | Computer Based Test |
| SPMB/PPDB | Seleksi/Penerimaan Murid Baru |
| SPP | Sumbangan Pembinaan Pendidikan |
| OTP | One-Time Password |
| RPO/RTO | Recovery Point/Time Objective |
| UAT | User Acceptance Test |

---

*BRD ini harus disetujui sebelum perubahan besar pada scope atau prioritas produk dilakukan.*
