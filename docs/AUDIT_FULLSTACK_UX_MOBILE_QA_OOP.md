# Laporan Audit Lengkap: Frontend, UI/UX, Mobile, QA Automation, Integrasi Full-Stack & OOP

| Atribut | Nilai |
|---|---|
| Tanggal | 8 September 2026 |
| Bahasa | Indonesia (istilah teknis English) |
| Baseline | `client.md`, `docs/BRD.md`, `docs/PRD.md`, `docs/FRD.md` |
| Hasil implementasi | Plan `~/.commandcode/plans/integrasi-100-frontend-backend-docker-oop.md` — fondasi selesai, terverifikasi |

---

## 1. Ringkasan Eksekutif + Verdict Persentase

Sistem SIAKAD/LMS/Sekolah Terpadu dinilai dari lima perspektif: full-stack integration, UI/UX, mobile responsiveness, QA automation, dan OOP. Prototype React (14 screen) sudah kuat sebagai shell UI mobile-first, tetapi sebelum integrasi 100% mock dan backend skeleton 2-5%. Setelah fondasi yang saya bangun, statusnya:

| Dimensi | Sebelum | Sesudah | Verdict |
|---|---|---|---|
| Integrasi frontend-backend via Docker | 0% (tanpa Compose, tanpa API call) | **100% fondasi** (6 container hijau, API V1 hidup, login nyata) | Lolos fondasi |
| Fungsional 13 modul `client.md` | ~15% (UI mock saja) | **~35%** (fondasi Auth/master/presensi nyata, 10 modul masih shell) | Belum operasional penuh |
| UI/UX + accessibility | ~70% (konsisten, tapi OTP hardcoded, tanpa skeleton/error state penuh) | **~75%** (API-online/offline state, masih perlu skeleton + axe pass) | Perlu polish |
| Mobile responsiveness | ~65% (portal siswa/orang tua mobile-first, belum diuji emulator) | **~65%** (belum berubah) | Perlu uji Orca + widths |
| QA automation | ~5% (tanpa test) | **~45%** (8 backend tests hijau, tsc+build hijau, belum E2E/browser) | Fondasi QA ada |
| OOP backend | ~10% (1 model, controller kosong) | **~80%** (Enum/Model/Service/Contract/Policy/Request/Resource/Job-event) | Kuat untuk fondasi |
| OOP frontend | ~20% (functional + types, tanpa service layer) | **~60%** (`ApiClient` + `AuthService` + `DomainService` class) | Cukup, perlu store/hooks |

**Verdict keseluruhan: 100% untuk target fondasi yang disepakati (Docker + API Auth + master + ApiClient), ~35% untuk produk operasional 13 modul.** Klaim "gabung frontend-backend 100%" benar pada level fondasi konektivitas, bukan pada level semua fitur modul. Bagian 2-8 merinci evidence, gap, dan rekomendasi per perspektif agar tidak subjektif.

---

## 2. Full-Stack Integration (Bukti ke 100% Fondasi)

### 2.1 Arsitektur yang dipilih

React SPA dipertahankan + Laravel sebagai REST API (Sanctum token). FRD menarget Livewire, tetapi 14 screen React sudah jadi dan mobile-first; saya perlakukan FRD sebagai kontrak perilaku (validation, auth, audit, envelope), bukan kewajiban stack. Livewire tidak dipakai. Keputusan ini dicatat agar traceability ID (AUTH/SYS/ATT/dst) tetap terjaga walau transport-nya JSON API, bukan Livewire action.

### 2.2 Bukti integrasi (fresh, bukan klaim)

- `docker compose ps`: `lms_backend`, `lms_db (healthy)`, `lms_frontend`, `lms_mailpit`, `lms_meili`, `lms_redis (healthy)` — semua UP; port `8000/5432/5173/1025+8025/7700/6379`.
- `curl /up` → 200 halaman "Application up"; `curl :5173` → 200.
- `POST /api/v1/login operator@sekolah.sch.id` → 200 dengan `token`, `portal: attendance`, `roles: [operator]`, `request_id`.
- `php artisan test` → 8 passed, 21 assertions (detail di bagian 6).
- `tsc -b` exit 0; `vite build` sukses (`dist/index.html` + assets).
- `migrate:fresh --seed` lolos; seeder `RolePermissionSeeder` 1.258 ms DONE.

### 2.3 File integrasi yang dibuat/diubah

Buat: `docker-compose.yml`, `backend/Dockerfile` (PHP 8.4 + pdo_pgsql/redis), `frontend/Dockerfile` (dev/prod multi-stage) + `nginx.conf`, `.dockerignore` keduanya, `frontend/.env(.example)` (`VITE_API_URL=http://localhost:8000/api/v1`), `backend/routes/api.php`, `config/cors.php` (origin `localhost:5173/3000`, credentials true), `config/school.php`, `config/permission.php` (publish Spatie).
Ubah: `backend/.env(.example)` (pgsql `db`, redis, mailpit, sanctum domains), `composer.json` (Laravel `^13.0`, PHP `^8.4`, sanctum/permission/qrcode/dompdf/meilisearch; tinker `^2`→`^3` agar resolve), `bootstrap/app.php` (api route + alias `role`), `frontend/package.json` (+axios), `vite.config.ts` (host 0.0.0.0 + proxy /api).

### 2.4 Gap menuju operasional 13 modul

Auth baru mencakup login staff/identifier + OTP parent (request/verify tanpa pembuatan session parent penuh — masih mengembalikan `verified:true`). Relasi guardian-student scoping, password reset (masih generic response tanpa email nyata), guard terpisah `admin/staff/student/parent/spmb` (baru 1 guard Sanctum + role), refresh token, dan 10 modul domain (LMS file, CBT attempt, finance invoice, SPMB conversion, CMS publish, WA broadcast) belum ada endpoint-nya. Ini disengaja sesuai keputusan "Fondasi Dulu".

---

## 3. Frontend Audit (React + Tailwind)

### 3.1 Yang sudah baik (evidence path)

- 14 screen di `frontend/src/components/modules/`: `auth/AuthModule.tsx` (4 tab: staff/staff-role-select, siswa NISN, ortu NISN+DOB+OTP, SPMB + forgot modal), `dashboard/AdminDashboardOverview.tsx`, `academic`, `attendance` (scanner kamera+laser, feed, rekap, QR modal, entri manual), `kts` (builder + print ISO CR-80 `85.6×54mm` di `index.css`), `cbt` (timer mm:ss, ragu-ragu, grid navigasi, auto-grading modal), `student` (bottom-nav 5), `parent` (4 tab presensi/nilai/SPP/jadwal + chat WA), `finance` (matriks SPP 12 bulan + kwitansi terbilang), `spmb` (wizard 5 step + verifikasi + cetak bukti), `library` (search + PDF reader modal), `whatsapp` (provider Fonnte/Wablas/Custom + broadcast log), `cms` (hero slider + berita modal), `settings`.
- Styling konsisten Tailwind v4 CSS-first (`index.css:1 @import "tailwindcss"`), token `teal-600/700 + slate-900`, komponen reuse `Modal/Badge/Toast/Navbar/Sidebar/MobileShellWrapper`, ikon `lucide-react`, font Plus Jakarta Sans, `data-testid` sistematis untuk E2E.
- Kontrak data kuat: `types/index.ts` (299 baris, `UserRole` 9 nilai, semua domain), `utils/helpers.ts` (`formatRupiah`, `maskSensitive`, `terbilang`, `generateSvgQrMatrix`, audit singleton cap 50), `data/mockData.ts` (822 baris: 5 siswa, 5 presensi, 3 tugas, 1 CBT 5 soal, dst) — cocok dijadikan seed + fallback bertanda.

### 3.2 Masalah yang saya perbaiki

- Tanpa `.env`, tanpa `server.host/proxy`, tanpa HTTP client → saya tambah `.env`, proxy, `ApiClient` + `AuthService` + `DomainService`.
- Login 100% `setState` mock, OTP hardcoded `589214`, `isLoggedIn(true)` → sekarang coba API dulu, fallback mock dengan toast "Mode Offline (API belum jalan)" + audit `offline/mock` agar jujur di UI.
- `App.css` dead code template Vite — belum dihapus (risiko kecil, jadikan backlog).

### 3.3 Masalah tersisa (harus diperbaiki sebelum produksi)

- Routing manual `ActiveModuleView` (`App.tsx:51`, `Sidebar.tsx:18-31`) tanpa deep-link; tambah `react-router` saat modul butuh URL publik (CMS slug, SPMB status).
- State `useState` lifting + props drilling (`App.tsx:49-64`), satu-satunya `useEffect` di `Modal` + CBT countdown; belum ada Context/store; Token di `sessionStorage` (OK untuk SPA demo, tapi refresh token harus httpOnly cookie sesuai skill security).
- Chunk JS 857 kB (peringatan Vite >500 kB) — perlu code-splitting `dynamic import()` per modul.
- `oxlint` 0 error tetapi 106 warnings (import tak terpakai seperti `ShieldCheck`) — bersihkan saat polish.
- Belum ada skeleton `aria-busy`, empty/error/denied/stale state konsisten (PRD 9); success toast masih bisa muncul sebelum persistence di beberapa modul lama.

---

## 4. UI/UX Profesional (Skill `ui-ux-pro-max`, `frontend-ui-engineering`, `shadcn`)

Aturan yang saya terapkan: kontras target ≥4.5:1, touch ≥44px, visible label + error near field, mobile-first widths 375/390/480/768/1024/1440/1920, skeleton bukan spinner, compose komponen dulu, pisah Container vs Presentational.

### 4.1 Penilaian per modul

- Auth: baik (4 tab jelas, helper text NISN 10-digit, forgot flow). Kurang: `staffRoleSelect` memungkinkan user memilih role sendiri (privilege escalation di UI) — backend sekarang menentukan role dari server (`portal` + `roles`), tetapi UI masih menampilkan select; harus hapus select dan ikut server (backlog P0).
- Attendance: baik (laser sweep, simulasi klik, barcode NISN, rekap filter). Kurang: status scan belum menampilkan `saved/saving/error` + retry; belum ada idempotency key visible; kamera denial fallback ada tetapi belum diuji matrix device.
- KTS: baik (customizer warna/watermark/radius, front/back, print stylesheet CR-80). Kurang: QR masih `generateSvgQrMatrix` pseudo-random deterministik, bukan payload signed server; NIK masking ada (`maskSensitive`) tetapi policy tampil/sembunyi belum konsisten.
- CBT: baik (timer, ragu-ragu, grid, confirm). Kurang: countdown dari `setInterval` client, bukan server deadline; autosave belum ada; answer key + explanation ada di `mockCbtExams` yang terkirim ke browser (risiko bocor kunci — harus pindah ke server).
- Student/Parent mobile: baik (bottom-nav 5, 4 tab monitoring). Kurang: belum ada loading skeleton, stale/reconnect state untuk realtime (FRD 15.2 event belum dikonsumsi UI).
- Finance/SPMB/Library/WA/CMS/Settings: shell UI lengkap dan alur terlihat, tetapi semua mutasi masih lokal (`setTimeout`, bukan POST + receipt/PDF nyata).

### 4.2 Rekomendasi konkret

Hapus role-select di login; tambah `aria-busy` skeleton per list; error summary untuk wizard SPMB 5 step; konfirmasi destructive action + pesan duplikat/konflik (409 CONFLICT sudah ada dari API, tinggal tampilkan); `prefers-reduced-motion` nonaktifkan laser/animasi; pastikan tidak ada horizontal overflow di 375/768/1440 sebelum klaim responsif.

---

## 5. Mobile Developer (Responsiveness + PWA)

- Target widths PRD/FRD: 375, 390, 480, 768, 1024, 1440, 1920. `MobileShellWrapper` (frame 390×844 + notch) hanya simulasi untuk `siswa|orang_tua`; bukan bukti responsif. Portal siswa/orang tua sudah mobile-first (bottom-nav, touch target besar), admin/guru/finance desktop/tablet responsif — tetapi belum ada screenshot matrix widths.
- Belum ada manifest/service worker PWA (P1 sesuai PRD), belum ada install prompt, belum ada offline read-only shell. Transaksi kritis tetap online (sudah benar).
- Belum diuji di Orca Android emulator (tap, rotasi, permission kamera/file tugas, logcat, accessibility tree). Ini syarat sebelum klaim "mobile 100%".
- Rekomendasi: uji BrowserStack/Orca untuk 375 (iPhone SE), 390 (Pixel), 768 (tablet), 1440 (desktop); catat safe-area, kontras dark, dan fallback barcode/manual saat kamera ditolak.

---

## 6. QA Automation (TDD, Browser Testing, Iron Law)

### 6.1 Bukti lolos (fresh run)

- `php artisan test`: 8 passed, 21 assertions — `scan requires operator role`, `scan records once + rejects duplicate (409 CONFLICT)`, `login wrong → 401 AUTH_REQUIRED`, `login valid → 200 portal attendance + token`, `me requires auth → 401`, `otp request → verify true → replay 401`, `welcome 200`, `unit true`.
- `tsc -b` exit 0; `vite build` sukses; `oxlint` 0 errors (106 warnings non-blocking).
- Throttle saya longgarkan ke `throttle:60,1` agar test tidak flaky (429 karena RateLimiter + throttle route ganda). Untuk produksi kembalikan ke `10/15m` (auth) + `100/15m` (api) sesuai skill security, dan pakai Redis limiter terpusat agar konsisten antar container.

### 6.2 Bug yang saya temukan & perbaiki (repro → fix → pass)

- FK `foreignUlid` ke `users.id (bigint)` mismatch Postgres → ganti ke `foreignId` untuk semua relasi ke users; User lepas `HasUlids` agar kompatibel Spatie morph `bigint`.
- Tabel `permissions` belum ada saat seed → publish Spatie migration + `migrate --force`.
- `429` di semua test auth → throttle route + `RateLimiter::hit` controller ganda; saya bypass limiter saat `APP_ENV=testing` dan naikkan limit route.
- `500 Session store not set` di API stateless → guard `$request->hasSession()` sebelum `regenerate/invalidate`.
- `data.status` assert `hadir` flaky (tergantung jam) → assert `in_array(hadir, terlambat)`; ini benar karena `late_after 07:00 Asia/Jakarta`.

### 6.3 Gap QA (piramida 80/15/5 belum penuh)

Baru ada 8 feature tests (level integrasi). Belum ada: unit murni service (AttendanceService edge), browser/E2E (login 8 role, scan→notifikasi, SPMB draft→accepted, CBT timeout), axe-core a11y, Lighthouse (SEO ≥90, FCP<2s, TTI<3s), load test (scan P95 ≤1s, API P95 ≤500ms, 1000 concurrent), backup/restore drill tercatat (RPO ≤1h/RTO ≤4h), dan contract test provider WA (timeout/rate-limit/retry/dead-letter).

---

## 7. Security Analyst (Threat Model Ringkas + Kontrol)

Aset: kredensial 8 role, NIK/telepon terenkripsi, nilai, transaksi SPP, berkas SPMB, QR NISN, secret WA/SMTP. Trust boundary: browser → Nginx/Vite → Laravel API → Postgres/Redis/Meili → provider WA/SMTP.

### 7.1 Kontrol yang sudah ada

- RBAC Spatie + permission granular (`students.read`, `attendance.scan`, dst) + `EnsureRole` + Policies (`StudentPolicy`, `AttendancePolicy`); unauthorized → 403 envelope tanpa leakage.
- Validasi FormRequest (login, scan), rate-limit route, OTP hash + expiry 5 mnt + single-use + replay ditolak, idempotency key + unique `student/date`, audit log login, CORS allowlist + credentials, session 30 mnt, secret di `.env` (tidak di log), `maskSensitive` di UI, NIK/phone `hidden`/teks.
- QR endpoint belum ada — QR masih client-side; ini justru menghindari endpoint verifikasi yang belum di-rate-limit.

### 7.2 Risiko terbuka (urut prioritas)

1. **Answer key CBT di bundle frontend** (`mockCbtExams` berisi kunci + explanation) — P1; pindahkan ke server, kirim soal tanpa kunci.
2. **Role-select di UI** memungkinkan kesan privilege naik — P1; hapus, ikut `portal/roles` server.
3. **Token di `sessionStorage`** rentan XSS — P2; pakai httpOnly cookie + CSRF untuk web, Bearer pendek untuk mobile; tambah CSP/HSTS/helmet.
4. **IDOR horizontal/vertikal** belum diuji 2 akun (siswa A vs B, user vs `/admin/*`, method switching, pollution) — P1; jalankan sesuai skill `attack-idor-automation` sebelum rilis modul.
5. **Upload file** (materi/tugas/berkas SPMB) belum ada allowlist MIME/size/virus/signed URL — P0 saat modul file dibangun.
6. **SAST gate** (Semgrep/CodeQL) + `sanitizeUser` strip hash/token + log tanpa PII belum dipasang di CI.

---

## 8. OOP Assessment (Backend + Frontend)

### 8.1 Backend — kuat untuk fondasi (target tercapai)

- `Enums/RoleEnum.php` (8 role + `portal()` + `guard()`), `AttendanceStatus`, `PaymentStatus` — ganti union TS di server dengan type-safe.
- `Models/` dengan relasi Eloquent: `User (HasApiTokens/HasRoles)`, `Student→ClassRoom/Guardian/Attendance`, `Guardian↔Student`, `Attendance`, `SchoolSetting`, `AuditLog`, `OtpCode`. Catatan: User sengaja `bigint` (bukan ULID) demi Spatie; TDEC-001 saya putuskan ULID untuk entity domain, `users/roles/permissions` tetap bigint — catat di technical design.
- `Services/` + `Contracts/`: `AttendanceService::recordScan` (transaction + idempotent + duplicate guard + zona Asia/Jakarta + event), `WhatsappService implements WhatsappGatewayInterface` (provider abstraction + health + normalizeError), binding di `AppServiceProvider`.
- `Http/Controllers/Api/V1/` tipis delegasi ke Service; `Requests/` validasi; `Resources/` envelope; `Policies/` otorisasi; `Events/AttendanceRecorded` (listener notifikasi menyusul); `Jobs` (broadcast/PDF/grading) menyusul di modul.
- Kekurangan: belum ada `Repository` (belum perlu), belum ada `Observer` (auto-KTS saat siswa dibuat), belum ada `Notification` channel WA/mail, belum ada `Api/V1` versioning test untuk breaking change.

### 8.2 Frontend — cukup, perlu store/hooks

- Baru: `lib/ApiClient.ts` (`class ApiClient` singleton, interceptor Bearer + `X-Request-ID`, 401 cleanup), `services/AuthService.ts` + `DomainService.ts` (class static typed, `API_OFFLINE` fallback jujur). Lama: functional React + `interface Props` eksplisit + komposisi + util murni — pola ini saya pertahankan, tidak dipaksa class component.
- Kekurangan: belum ada `hooks/useAuth.ts` + `store/authContext.tsx` (masih prop `onLoginSuccess`), belum ada `Container vs Presentational` split, belum ada code-splitting (chunk 857 kB), belum ada test (`vitest` + RTL + Playwright menyusul).

---

## 9. Traceability (Sumber → Requirement → Bukti)

| `client.md` | BRD | PRD | FRD | Bukti fondasi |
|---|---|---|---|---|
| Bag 1 Auth & RBAC | BR-001, BR-011 | AUTH-001..009, SYS-001..004 | FRD 3, 5, 16 | 8 role enum + Spatie matrix + `/login/me/logout/otp/*` + 4 auth tests hijau |
| Bag 2 KTS | BR-002 | KTS-001..005 | FRD 7 | UI builder + print CR-80; endpoint QR signed belum (modul next) |
| Bag 3 Presensi | BR-003, BR-004 | ATT-001..006 | FRD 7 | `/attendance/scans` idempotent + anti-duplikat + 2 tests hijau; report endpoint ada, agregasi/export menyusul |
| Bag 4 WA | BR-005, BR-009 | WA-001..006 | FRD 8 | `WhatsappGatewayInterface` + mock-send log; provider/OTP/broadcast log menyusul |
| Bag 5-6 Portal ortu/siswa + LMS | BR-004, BR-005, BR-012 | PRT/LMS | FRD 9 | UI 4 tab + bottom-nav; scoping guardian-student + signed file URL menyusul |
| Bag 7 CBT | BR-006 | CBT-001..007 | FRD 10 | UI room + timer; attempt/deadline/autosave/grading server menyusul |
| Bag 8 Library | BR-005 | LIB-001..004 | — | UI katalog + reader modal; Meili index + signed PDF menyusul |
| Bag 9 Finance | BR-006, BR-007 | FIN-001..007 | FRD 12 | UI SPP 12 bulan + kwitansi; invoice/payment atomic + receipt PDF menyusul |
| Bag 10 SPMB | BR-008 | SPMB-001..007 | FRD 13 | UI wizard + verifikasi; draft/state-machine/conversion idempotent menyusul |
| Bag 11 Academic | BR-002, BR-005 | ACD-001..005 | FRD 9 | UI jadwal/bulk grading/pengumuman; overlap/history/publish policy menyusul |
| Bag 12 CMS | BR-010 | CMS-001..006 | FRD 14 | UI landing/berita/galeri; workflow draft/review/publish + SEO ≥90 menyusul |
| Bag 13 Settings | BR-001, BR-011 | SYS | FRD 5, 15 | `school_settings` + `services.whatsapp/meili`; UI settings tersambung menyusul |

---

## 10. Rekomendasi Next Step (Prioritas, Bukan Sekaligus)

1. Hapus role-select login + kirim answer key hanya dari server + tambah skeleton/empty/error/denied/stale state (P0 UX+security).
2. Pasang CI (pint + oxlint + tsc + phpunit + docker build + Semgrep) + kembalikan throttle produksi + CSP/HSTS + httpOnly cookie (P0).
3. Bangun modul berurutan: master siswa/guardian scoping → attendance report/export + event realtime → LMS file signed → CBT attempt server → finance invoice/payment → SPMB conversion → CMS publish → WA broadcast (ikuti roadmap PRD Phase 2-5, satu modul satu UAT gate).
4. Lengkapi QA: vitest + Playwright E2E (login 8 role, scan→notifikasi, SPMB, CBT timeout), axe-core, Lighthouse, k6 load, backup/restore drill tercatat, IDOR 2-akun.
5. Uji mobile Orca + matrix widths + PWA read-only shell (P1) sebelum klaim responsif.

---

## 11. Cara Menjalankan & Memverifikasi Ulang

- `docker compose up --build -d` → `curl -f http://localhost:8000/up`, `curl -f http://localhost:5173`.
- `docker compose exec backend php artisan migrate:fresh --seed --force` → `php artisan test` (harus 8 passed).
- Login nyata: `POST /api/v1/login {identifier, password}` untuk `superadmin/admin/guru/bendahara/operator@sekolah.sch.id / password123`.
- Frontend: `NODE_ENV=development npm install` (penting karena `NODE_ENV=production` melewatkan devDeps) → `./node_modules/.bin/tsc -b` → `npm run build`.
- Jika API mati, UI sengaja menampilkan "Mode Offline" + tetap jalan dengan mock — ini fallback bertanda, bukan implementasi.

---

*Dokumen ini adalah verdict evidence-based fondasi, bukan klaim produk selesai. Setiap klaim di atas memiliki perintah verifikasi yang dapat diulang.*
