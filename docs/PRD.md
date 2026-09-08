# Product Requirements Document (PRD)
## SIAKAD, LMS, dan Portal Sekolah Terpadu

| Atribut | Nilai |
|---|---|
| Versi | 2.0 |
| Status | Draft untuk product review |
| Tanggal | 8 September 2026 |
| Product owner | Perwakilan manajemen sekolah |
| Business baseline | [`client.md`](../client.md), [`BRD.md`](./BRD.md) |
| Functional baseline | [`FRD.md`](./FRD.md) |

> PRD ini mendefinisikan apa yang dibangun, untuk siapa, mengapa, prioritas, dan bagaimana keberhasilannya diverifikasi. BRD mendefinisikan outcome bisnis; FRD mendefinisikan perilaku/kontrak implementasi.

---

## 1. Product Vision

Menyediakan satu platform sekolah yang aman, mudah digunakan, mobile-first, dan dapat diaudit untuk menghubungkan operasional akademik, pembelajaran digital, monitoring orang tua, keuangan, penerimaan murid baru, komunikasi, dan website publik.

### 1.1 Value proposition

- **Manajemen sekolah:** satu sumber data dan laporan yang dapat ditelusuri.
- **Guru:** waktu lebih sedikit untuk administrasi dan lebih banyak untuk pembelajaran.
- **Siswa:** satu portal untuk jadwal, materi, tugas, ujian, dan nilai.
- **Orang tua:** informasi anak yang cepat, relevan, dan terbatas pada relasi yang sah.
- **Bendahara:** tagihan, pembayaran, kwitansi, dan laporan yang konsisten.
- **Calon siswa:** pendaftaran yang dapat dilanjutkan dan status yang transparan.
- **Publik:** website sekolah yang aktual dan dapat dikelola tanpa deploy kode.

## 2. Problem Statement dan Outcome

Sekolah memerlukan pengurangan proses manual, duplikasi data, komunikasi yang terlambat, dan risiko kehilangan arsip. Produk harus mengubah proses tersebut menjadi workflow digital yang tersimpan, authorized, observable, dan dapat diuji.

Outcome bisnis dan KPI ditetapkan pada [`BRD.md`](./BRD.md) bagian 3 dan 10. UI yang hanya menampilkan mock data, toast sukses, atau perubahan state lokal tidak memenuhi definisi selesai.

## 3. Target Users dan Personas

| Persona | Job to be done | Pain point | Outcome produk |
|---|---|---|---|
| Super Admin | Menjaga governance dan integrasi | Konfigurasi tersebar, akses berlebih | Permission, settings, audit, health |
| Admin/TU | Mengelola data operasional | Rekap dan data manual | Master data, import, laporan |
| Guru | Mengelola pembelajaran/asesmen | Tugas/nilai/ujian terpisah | LMS, bulk grading, CBT |
| Bendahara | Menagih dan melaporkan | Rekonsiliasi manual | Invoice, payment, receipt, report |
| Operator | Mencatat presensi/SPMB | Input dan notifikasi lambat | QR scan, fallback, status |
| Siswa | Belajar dan mengikuti ujian | Akses materi/status tidak terpusat | Mobile portal, LMS, CBT |
| Orang Tua | Memantau anak | Informasi terlambat/tidak relevan | Four-tab monitoring portal |
| Calon Siswa | Mendaftar dan memantau seleksi | Form panjang dan status tidak jelas | Draft resume, upload, status |
| Publik | Menemukan informasi sekolah | Konten website usang | CMS publik SEO-ready |

## 4. Role dan Access Principle

Sistem memiliki delapan role terautentikasi: Super Admin, Admin/TU, Guru, Bendahara, Operator, Siswa, Orang Tua, dan Calon Siswa. Public visitor bukan role login.

Prinsip produk:

1. Pengguna hanya melihat data yang dimiliki atau menjadi tanggung jawabnya.
2. Role tidak dapat dipilih bebas dari login untuk menaikkan privilege.
3. Guard/session antar portal terisolasi.
4. Semua mutation penting memiliki audit trail.
5. Data sensitif dimasking/encrypted; akses file memakai authorization.
6. Detail permission dan route matrix berada di [`FRD.md`](./FRD.md) bagian 3.

## 5. Scope dan Release Strategy

### 5.1 MVP/P0 — wajib untuk rilis operasional

- Auth, RBAC, session isolation, reset password, dan audit dasar.
- Data siswa, parent link, academic year, class, major, subject, schedule.
- QR/barcode attendance, rekap date range, klasifikasi status, dan notification job.
- Student portal: jadwal, material access/download, assignment submission, grades.
- Parent portal: attendance, grades, SPP, schedule/announcement, scoped child data.
- Teacher/admin academic flow: schedule, bulk grading, announcement.
- CBT: authoring baseline, schedule enforcement, server clock/timer, autosave, submit, grading.
- Library: catalog, search/filter, PDF reader, stock visibility.
- Finance: payment items, invoice distribution, 12-month SPP, cash transactions, receipt, reports baseline.
- SPMB: wave, multi-step draft, upload, verification, status, accepted conversion, proof.
- WhatsApp/email provider abstraction, OTP, attendance notification, broadcast delivery log.
- Public CMS baseline: landing, profile, news, gallery, SEO metadata.
- System settings, security baseline, backup, monitoring, CI quality gates.

### 5.2 P1 — penting setelah core operational flow stabil

- Multi-provider fallback policy dan advanced broadcast segmentation.
- Bank account/reconciliation enhancement.
- Advanced finance reports and exports.
- Library borrowing/return workflow.
- CMS agenda, maps, social media, advanced SEO schema.
- Parent multi-child switcher bila data model dan policy sudah disetujui.
- PWA offline read-only shell dan install prompt.
- 2FA untuk Admin dan Bendahara.

### 5.3 P2 — nice-to-have

- Advanced analytics and predictive dashboards.
- Native mobile application.
- Dapodik/Rapor Digital integrations.
- AI-assisted insights.
- Biometric/facial attendance.
- Full payroll/ERP/payment gateway settlement.

### 5.4 Out of scope

Payroll/HR penuh, double-entry ERP, video conference, marketplace, native app terpisah pada rilis awal, integrasi nasional tanpa kontrak resmi, facial recognition, dan AI grading. Perubahan membutuhkan change request.

## 6. Epic dan Feature Catalog

| Epic | Product requirement | Priority | Primary role | FRD |
|---|---|---:|---|---|
| AUTH | Delapan role, guard, RBAC, reset, OTP parent, session isolation | P0 | Semua | 5 |
| KTS | CR-80, QR signed/verified, builder, preview, print/PDF | P0/P1 | Admin, siswa, parent | 7 |
| ATT | Camera/barcode, status, report date range, fallback | P0 | Operator, guru | 7 |
| WA | Provider, test, OTP, attendance notification, broadcast, logs | P0 | Admin/system | 8 |
| PRT | Four tabs, child scoping, KTS, WhatsApp contact, realtime | P0 | Parent | 9 |
| LMS | Mobile portal, materials, assignment upload/status, grades | P0 | Student/guru | 9 |
| CBT | Authoring, schedule, timer, autosave, submit, auto-grade | P0 | Guru/student | 10 |
| LIB | Catalog, search, PDF.js reader, stock | P0 | Semua | 11 |
| FIN | Item, invoice distribution, SPP, cash, bank, receipt, reports | P0 | Bendahara | 12 |
| SPMB | Wave, form draft, files, verification, conversion, proof | P0 | Admin/applicant | 13 |
| ACD | Year, class, schedule, bulk grade, announcement | P0 | Admin/guru | 9 |
| CMS | Public pages, post, gallery, profile, SEO | P0 | Admin/public | 14 |
| SYS | School identity, gateway, SMTP, SPMB switch, operations | P0 | Super Admin | 5, 15 |

## 7. User Journeys dan User Stories

### 7.1 Staff login dan authorization

1. Staff membuka portal login.
2. Staff mengirim email/password.
3. Sistem menentukan role dari account server, bukan pilihan form.
4. Sistem membuat session dan menampilkan dashboard sesuai permission.
5. Akses ke modul yang tidak diizinkan ditolak dan dicatat.

**Stories:**

- As a staff user, I want to login securely so that my portal reflects my real role.
- As an admin, I want to reset a password through email so that account recovery is auditable.
- As a security owner, I want session timeout/revoke so that abandoned sessions are not reusable.

### 7.2 Presensi siswa

1. Operator membuka scanner.
2. QR/barcode dibaca atau fallback manual digunakan.
3. Sistem memvalidasi siswa, jadwal, duplikasi, dan timestamp server.
4. Status disimpan; operator melihat feedback.
5. Parent notification diproses dan delivery status tersedia.

**Stories:** operator records attendance in one scan; parent receives verified status; admin filters daily/monthly reports.

### 7.3 Siswa belajar

1. Siswa login dan melihat portal mobile.
2. Siswa membuka jadwal/material.
3. Siswa membaca atau mengunduh file yang authorized.
4. Siswa mengupload submission sebelum deadline.
5. Guru memberi nilai/feedback; status terlihat oleh siswa.

### 7.4 CBT

1. Guru publish exam dengan target class dan schedule.
2. Siswa hanya dapat start dalam window.
3. Server membuat attempt dan deadline.
4. Jawaban autosave, timer reconnect/resync, manual/auto submit.
5. Server grading dan publish result sesuai policy.

### 7.5 Finance

1. Bendahara mendefinisikan payment item.
2. Tagihan didistribusikan ke target siswa.
3. Pembayaran dicatat idempotent.
4. Kwitansi actual dapat dicetak/PDF.
5. Laporan periodik mencocokkan total transaksi.

### 7.6 SPMB

1. Admin membuka wave.
2. Applicant membuat account dan mengisi langkah.
3. Draft tersimpan; berkas di-upload private.
4. Panitia verifikasi dan memberi status/catatan.
5. Accepted memicu conversion idempotent dan proof tersedia.

### 7.7 CMS publik

1. Admin membuat draft konten.
2. Konten direview/publish.
3. Public hanya melihat published content.
4. SEO metadata, media, sitemap, dan analytics/performance diverifikasi.

## 8. Functional Requirements dan Acceptance Criteria

### 8.1 Auth/RBAC — AUTH-001..009

- **Given** akun dengan role tertentu aktif, **when** login memakai credential valid, **then** server membuat session guard yang benar dan mengarahkan ke portal sesuai permission.
- **Given** user mencoba membuka route/resource di luar scope, **when** request dikirim, **then** sistem menolak dengan 403/redirect aman tanpa membocorkan data.
- **Given** user meminta reset password, **when** email valid/tidak valid dikirim, **then** response generik konsisten; email reset hanya memakai token expiring single-use.
- **Given** parent meminta OTP, **when** kode benar sebelum 5 menit dan belum consumed, **then** login berhasil; setelah expiry/replay, login ditolak.

### 8.2 KTS — KTS-001..005

- **Given** siswa aktif dan template version valid, **when** admin membuka preview, **then** card menampilkan field wajib dan rasio CR-80.
- **Given** user authorized menekan download/print, **when** job selesai, **then** file actual atau print stylesheet menghasilkan ukuran fisik yang benar dan dapat diverifikasi.
- **Given** QR dipindai, **when** payload valid dan tidak revoked, **then** endpoint verifikasi mengembalikan identifier yang sesuai tanpa membocorkan data sensitif.

### 8.3 Attendance — ATT-001..006

- **Given** QR siswa valid, **when** scan diproses pada sesi sekolah, **then** satu record tercatat dengan server timestamp dan status otomatis.
- **Given** record siswa sudah ada pada sesi/tanggal sama, **when** QR dipindai ulang, **then** sistem tidak membuat duplikat dan menampilkan alasan.
- **Given** admin memilih kelas dan rentang tanggal, **when** laporan dimuat, **then** agregasi harian/bulanan sesuai scope dan data tersimpan.
- **Given** kamera ditolak/tidak tersedia, **when** operator memilih fallback, **then** barcode/manual path tetap memiliki authorization dan audit.

### 8.4 WhatsApp — WA-001..006

- **Given** provider configured, **when** admin menjalankan test message, **then** pesan hanya ke nomor konfirmasi dan hasil provider tercatat.
- **Given** attendance berhasil, **when** event diproses, **then** notification job memiliki idempotency key dan status pending/sent/failed yang dapat diaudit.
- **Given** provider timeout, **when** retry limit terlampaui, **then** status failed/dead-letter terlihat dan tidak terjadi duplikasi tanpa retry policy.

### 8.5 Parent — PRT-001..007

- **Given** parent login valid, **when** dashboard dibuka, **then** empat tab menampilkan data hanya dari linked child.
- **Given** data berubah di server, **when** event realtime diterima, **then** tab memperbarui data atau memberi stale/retry state.
- **Given** parent menekan contact/KTS, **when** resource authorized, **then** URL WhatsApp/file KTS valid dan action tercatat bila perlu.

### 8.6 LMS — LMS-001..005

- **Given** student berada pada class target, **when** material dibuka, **then** tipe PDF/Word/PPT/video tervalidasi dan akses file memakai signed authorization.
- **Given** assignment belum melewati policy deadline, **when** file dikirim, **then** multipart upload tersimpan, submission receipt muncul, dan status berubah menjadi submitted.
- **Given** deadline terlewati, **when** student mengirim, **then** sistem menerapkan late policy secara eksplisit dan tidak menyamarkan hasil.
- **Given** guru memberi grade/feedback, **when** publish diizinkan, **then** student melihat status graded beserta feedback.

### 8.7 CBT — CBT-001..007

- **Given** exam published dan jadwal aktif, **when** siswa start, **then** attempt memiliki server deadline.
- **Given** siswa memilih jawaban, **when** autosave berhasil/gagal, **then** UI menampilkan saved/saving/error dan retry tidak menduplikasi.
- **Given** window belum/ sudah tutup, **when** siswa start, **then** request ditolak.
- **Given** timer habis, **when** server memproses timeout, **then** attempt auto-submit, grading idempotent, dan hasil sesuai policy.

### 8.8 Library — LIB-001..004

- **Given** query title/author/category/ISBN, **when** search dikirim, **then** hasil relevan, paginated, dan scoped.
- **Given** user memiliki akses e-book, **when** reader dibuka, **then** PDF.js memuat dokumen actual dengan page navigation, zoom, loading/error state.
- **Given** borrow/return aktif, **when** transaksi concurrent terjadi, **then** stock lock mencegah stok negatif.

### 8.9 Finance — FIN-001..007

- **Given** item dan target kelas/angkatan valid, **when** invoice distribution dijalankan, **then** preview dan hasil jumlah target dapat diverifikasi serta rerun idempotent.
- **Given** invoice memiliki nominal, **when** payment penuh/cicilan dicatat, **then** status dan saldo dihitung konsisten dalam transaction.
- **Given** payment tersimpan, **when** receipt dicetak, **then** PDF memuat nomor unik, payer, item, amount, issuer, date, dan verification code.
- **Given** periode laporan dipilih, **when** report dimuat/export, **then** income, expense, balance, dan reconciliation totals cocok dengan transaksi.

### 8.10 SPMB — SPMB-001..007

- **Given** wave open dan kuota tersedia, **when** applicant submit step, **then** draft tersimpan dan dapat dilanjutkan setelah logout/login.
- **Given** file invalid, **when** upload dikirim, **then** sistem menolak dengan alasan spesifik tanpa menyimpan file berbahaya.
- **Given** application accepted, **when** conversion job dijalankan ulang, **then** hanya satu account/student placement dibuat dan hasil dapat direkonsiliasi.
- **Given** application rejected, **when** admin menyimpan status, **then** rejection reason wajib dan applicant melihat status sesuai policy.

### 8.11 Academic/announcements — ACD-001..005

- **Given** academic year baru diaktifkan, **when** data histori ada, **then** histori tetap dapat dibaca dan tidak terhapus.
- **Given** bulk grades valid, **when** guru commit, **then** semua row diproses sesuai transaction/result report dan publish policy.
- **Given** announcement published untuk audience tertentu, **when** portal dibuka/event diterima, **then** hanya audience tersebut melihat announcement.

### 8.12 CMS — CMS-001..006

- **Given** admin memiliki permission, **when** post/gallery/profile dipublish, **then** content memiliki author, timestamp, slug unique, sanitized body, dan SEO metadata.
- **Given** public visitor membuka website, **when** content belum published/expired, **then** content tidak tampil.
- **Given** halaman publik dirilis, **when** Lighthouse/accessibility check dijalankan, **then** SEO ≥90 dan requirement semantic/metadata/alt text terpenuhi.

### 8.13 System — SYS-001..004

- **Given** super admin menyimpan identity/gateway/SMTP/SPMB config, **when** validation sukses, **then** perubahan versioned, encrypted bila secret, audit tercatat, dan consumer membaca config terbaru.
- **Given** gateway belum diuji, **when** admin mengaktifkan provider, **then** sistem mencegah aktivasi atau memberi warning sesuai policy.
- **Given** SPMB test mode aktif, **when** non-admin mencoba mengakses, **then** akses ditolak dan event dicatat.

## 9. UI States dan UX Requirements

Semua screen/Livewire component wajib memiliki state:

- initial/loading dengan skeleton atau progress yang tidak menyesatkan;
- empty state dengan next action;
- validation error per field dan error summary untuk form panjang;
- permission denied tanpa data leakage;
- server/integration error dengan retry/support reference;
- stale/reconnecting state untuk realtime;
- success state yang hanya muncul setelah persistence/queue acceptance, bukan sebelum;
- destructive action confirmation dan duplicate/conflict message.

Responsive target: 375, 390, 480, 768, 1024, 1440, 1920 px. Portal siswa mobile-first; admin/guru/finance responsive desktop/tablet. Accessibility target WCAG 2.1 AA, visible focus, keyboard path, semantic HTML, live regions, contrast ≥4.5:1, reduced motion, dan touch target ≥44px.

## 10. Non-Functional Requirements

| ID | Area | Requirement/target | Verification |
|---|---|---|---|
| NFR-001 | Performance | FCP <2 detik, TTI <3 detik pada target profile | Lighthouse/field profile |
| NFR-002 | API | P95 common API ≤500 ms, diukur tanpa external provider | Load/APM |
| NFR-003 | Attendance | Scan-to-record P95 ≤1 detik pada agreed load; end-to-end notification target <15 detik | Load/integration |
| NFR-004 | Availability | Uptime ≥99,5% per bulan, scheduled maintenance dikecualikan | Monitoring |
| NFR-005 | Capacity | Minimum 1.000 concurrent users sesuai capacity test | Stress/load |
| NFR-006 | Security | OWASP baseline, CSRF, CSP, HSTS, encryption, rate limit, RBAC, audit | Security test/review |
| NFR-007 | Privacy | NIK/phone/secret encrypted/masked; retention dan deletion policy | Data/security test |
| NFR-008 | Accessibility | WCAG 2.1 AA pada core flows | axe/manual |
| NFR-009 | Responsive | Tidak clipping/horizontal overflow pada target widths | Browser matrix |
| NFR-010 | PWA | Installable manifest/service worker untuk static/read-only shell P1 | Lighthouse/manual |
| NFR-011 | SEO | Public CMS Lighthouse SEO ≥90 | CI Lighthouse |
| NFR-012 | Files | Private storage, signed URL, MIME/size/virus validation | Security/integration |
| NFR-013 | Backup | RPO ≤1 jam, RTO ≤4 jam, restore drill berkala | Operations drill |
| NFR-014 | Quality | Backend test coverage ≥80%, lint/static analysis/build wajib pass | CI |
| NFR-015 | Observability | Structured logs, request ID, health, queue/provider/backup alerts | Ops validation |

Konflik target lama diselesaikan sebagai berikut: target QR/notification memakai angka P0 lebih ketat yang didefinisikan di tabel ini; pengukuran harus menyebut percentile, load, timezone, dan boundary (client/server/provider).

## 11. Data, Privacy, dan Notification Policy

- Student/parent/finance data adalah restricted; access berdasarkan relationship/policy, bukan hanya hidden navigation.
- NIK, phone, bank, provider key, SMTP secret, password, OTP plain text, dan answer key tidak boleh masuk log atau public payload.
- Nilai dan pengumuman memiliki publish status; draft tidak terlihat student/parent.
- Notification harus memiliki consent/eligibility, template version, recipient snapshot, delivery status, retry, dan audit.
- Data retention, alumni archival, deletion/anonymization, dan legal hold mengikuti keputusan `DEC-004`.
- File download/upload harus dapat ditelusuri tanpa menyimpan credential atau signed URL permanen.

## 12. Dependencies dan Assumptions

Target stack: Laravel 13, PHP 8.4+, Livewire 3, Blade/TailwindCSS 4/AlpineJS 3, PostgreSQL 17, Redis 7, Reverb, Horizon, Meilisearch, Laravel Storage/S3-compatible, Fonnte/Wablas/custom REST, SMTP/Mailpit, DomPDF, PDF.js, QR generator, Google Maps, Docker, dan GitHub Actions.

Assumsi serta dependency eksternal dan keputusan yang belum final tercatat di [`BRD.md`](./BRD.md) bagian 11 dan [`FRD.md`](./FRD.md) bagian 22.

## 13. Roadmap dan Quality Gates

| Phase | Fokus | Exit gate |
|---|---|---|
| 0 | Environment, Docker, CI, Laravel foundation | Build/lint/test pipeline dan health check pass |
| 1 | Auth/RBAC, settings, master data | Route matrix, security tests, migrations, seed pass |
| 2 | Academic core, KTS, attendance, notifications | Scan/report/audit/notification UAT pass |
| 3 | Student/parent portal, LMS, CBT, library | Mobile/accessibility/realtime/load/file UAT pass |
| 4 | Finance, SPMB, broadcast | Financial invariants, PDF, workflow/idempotency UAT pass |
| 5 | CMS, SEO, performance, backup, launch | Lighthouse, restore drill, security, UAT sign-off |

### 13.1 Definition of Ready

Feature memiliki requirement ID, role, scope, acceptance criteria, owner, dependency, data/privacy decision, UX state, dan FRD section.

### 13.2 Definition of Done

Feature memiliki implementation persistence, authorization, validation, loading/empty/error state, responsive/accessibility behavior, audit/notification bila diwajibkan, automated tests, UAT evidence, logs/metrics hook, migration/rollback consideration, dan documentation update.

## 14. Risks dan Mitigations

Risiko bisnis utama, owner, dan mitigasinya berada di [`BRD.md`](./BRD.md) bagian 12. Risiko produk yang wajib dipantau: third-party provider outage, CBT concurrency, file/security abuse, data migration quality, camera compatibility, realtime disconnect, content governance, dan scope creep.

## 15. Traceability Matrix

| Client area | BRD | PRD requirement | FRD | QA/UAT evidence |
|---|---|---|---|---|
| Auth & security | BR-001, BR-011 | AUTH-001..009, SYS-003 | 3, 5, 16 | Auth/security suite |
| KTS | BR-002 | KTS-001..005 | 7 | QR/print/PDF test |
| Attendance | BR-003, BR-004 | ATT-001..006 | 7 | Browser/load/integration |
| WhatsApp | BR-005, BR-009 | WA-001..006 | 8 | Provider/queue/retry |
| Parent | BR-004 | PRT-001..007 | 9 | Scoped/realtime tests |
| LMS | BR-005, BR-012 | LMS-001..005 | 9 | Responsive/file tests |
| CBT | BR-006 | CBT-001..007 | 10 | Schedule/autosave/load |
| Library | BR-005 | LIB-001..004 | 11 | Search/PDF/stock |
| Finance | BR-006, BR-007 | FIN-001..007 | 12 | Invariant/PDF/report |
| SPMB | BR-008 | SPMB-001..007 | 13 | Workflow/upload tests |
| Academic | BR-002, BR-005 | ACD-001..005 | 9 | History/bulk/publish |
| CMS | BR-010 | CMS-001..006 | 14 | CMS/SEO/Lighthouse |
| NFR/operations | BR-011, BR-012 | NFR-001..015 | 16-20 | CI/ops/accessibility |

## 16. Open Product Decisions

| ID | Decision | Default | Owner | Status |
|---|---|---|---|---|
| DEC-001 | WhatsApp primary/fallback | Fonnte/Wablas adapter | Super Admin | TBD |
| DEC-002 | Payment reconciliation | Manual reference verification | Bendahara | TBD |
| DEC-003 | Grade publication authority | Teacher submit, wali/admin publish | Wakil Kurikulum | TBD |
| DEC-004 | Data retention/alumni | School/legal policy | Kepala Sekolah | TBD |
| DEC-005 | PWA offline boundary | Read-only static shell | IT/Product | TBD |
| DEC-006 | Legacy import template | Versioned CSV/XLSX | Admin/TU | TBD |
| DEC-007 | Support SLA/severity | P1/P2/P3 operational policy | IT/Product | TBD |

## 17. Change Log

| Versi | Tanggal | Perubahan | Author |
|---|---|---|---|
| 1.0/1.1 | 8 Sep 2026 | Draft awal feature/stack/phase | Project team |
| 2.0 | 8 Sep 2026 | Dipisah dengan BRD/FRD; ditambah persona, roadmap, GWT acceptance, UI states, NFR terukur, privacy, traceability, gates, dan open decisions | Engineering/Product |

## 18. Glossary

SIAKAD, LMS, RBAC, KTS, NISN, NIK, NPSN, CBT, SPMB/PPDB, SPP, OTP, CMS, PWA, UAT, RPO, RTO, FCP, TTI, dan P95 menggunakan definisi yang sama seperti [`BRD.md`](./BRD.md) dan [`FRD.md`](./FRD.md).

---

*PRD ini belum menjadi baseline final sampai product owner menyetujui scope P0, open decisions, target NFR, dan UAT gate.*
