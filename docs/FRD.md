# Functional Requirements Document (FRD)
## SIAKAD, LMS, dan Portal Sekolah Terpadu

| Atribut | Nilai |
|---|---|
| Versi | 1.0 |
| Status | Draft untuk technical review |
| Tanggal | 8 September 2026 |
| Sumber bisnis | [`client.md`](../client.md), [`BRD.md`](./BRD.md) |
| Product specification | [`PRD.md`](./PRD.md) |
| Target architecture | Laravel 13, Livewire 3, Blade, TailwindCSS 4, AlpineJS 3 |

> FRD ini menjelaskan perilaku fungsional dan kontrak teknis minimum. Nama tabel, action, endpoint, dan event adalah baseline yang harus dikonfirmasi saat technical design; perubahan harus menjaga ID requirement dan traceability.

---

## 1. Tujuan dan Batasan

FRD menjadi acuan implementasi bagi UX, frontend/Livewire, backend, database, integrasi, QA, dan DevOps. Dokumen ini mencakup portal publik, portal admin/guru/bendahara/operator, portal siswa, portal orang tua, portal calon siswa, serta domain SIAKAD, LMS, CBT, library, finance, SPMB, WhatsApp, CMS, dan settings.

Prototype React/Vite pada `frontend/` dicatat sebagai referensi screen/prototype. Baseline production mengikuti target Laravel/Livewire pada `client.md` dan BRD; data mock atau toast tidak dianggap sebagai implementasi persistence, security, download, realtime, atau integrasi.

## 2. Arsitektur dan Batas Sistem

### 2.1 Komponen

| Layer | Komponen | Tanggung jawab |
|---|---|---|
| Edge | Nginx, HTTPS, HSTS, CSP | TLS termination, routing, security headers |
| Application | Laravel 13/PHP 8.4 | Domain logic, HTTP, jobs, policies, notifications |
| UI | Blade, Livewire 3, AlpineJS 3, TailwindCSS 4 | Server-driven UI, interaction, validation feedback |
| Auth | Fortify, Spatie Permission, Sanctum | Authentication, password reset, role/ability, API token |
| Data | PostgreSQL 17 | Source of truth dan histori |
| Cache/session | Redis 7 | Session, cache, lock, queue broker |
| Realtime | Laravel Reverb + Echo | Presence/attendance, announcements, status updates |
| Queue | Horizon + Redis | Notification, PDF, import, grading, broadcast |
| Search | Meilisearch | Katalog library dan pencarian yang di-index |
| Storage | Laravel Storage, S3-compatible | Foto, materi, submission, berkas SPMB, export |
| Document | DomPDF, PDF.js | PDF server-side dan browser reader |
| QR | SimpleSoftwareIO/QrCode | QR SVG/Png berbasis payload tervalidasi |
| External | WhatsApp provider, SMTP, Google Maps | Notifikasi, email, maps |
| Operations | Docker, CI/CD, logs, metrics, backups | Delivery, observability, recovery |

### 2.2 Prinsip boundary

- PostgreSQL adalah sumber kebenaran; state UI tidak boleh menjadi satu-satunya penyimpanan transaksi.
- Semua mutation melewati authorization policy, validation, audit log bila kritis, dan transaction/lock bila berisiko duplikasi.
- Data sensitif tidak dimasukkan ke URL, log plain text, QR publik, atau payload browser tanpa masking/encryption yang sesuai.
- Realtime adalah delivery optimization; halaman harus memiliki fallback refresh/polling dan konsistensi dari database.
- File disimpan private secara default; akses menggunakan authorization dan temporary signed URL.

## 3. Role, Guard, dan Permission Matrix

### 3.1 Role

| Code | Role | Guard/metode login |
|---|---|---|
| `super_admin` | Super Admin | `admin`, email + password |
| `admin_tu` | Admin/TU | `admin`, email + password |
| `guru` | Guru | `staff`, email + password |
| `bendahara` | Bendahara | `staff`, email + password |
| `operator` | Operator | `staff`, email + password |
| `siswa` | Siswa | `student`, NISN + password |
| `orang_tua` | Orang Tua | `parent`, NISN anak + tanggal lahir/OTP |
| `calon_siswa` | Calon Siswa | `spmb`, registration number + password |

`public` bukan role terautentikasi; hanya dapat mengakses halaman CMS public dan endpoint public yang allowlisted.

### 3.2 Matrix ringkas

| Capability | Super Admin | Admin/TU | Guru | Bendahara | Operator | Siswa | Orang Tua | Calon Siswa |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| User/role/settings | C/R/U/D | R/U terbatas | - | - | - | - | - | - |
| Data siswa/kelas | C/R/U/D | C/R/U/D | R terbatas | R terbatas | R operasional | R sendiri | R anak | - |
| Presensi scan | R | R | C/R | - | C/R/U | R sendiri | R anak | - |
| Nilai/jadwal | R | C/R/U/D | C/R/U | R terbatas | R | R sendiri | R anak | - |
| Materi/tugas | R | R | C/R/U/D | - | - | R/C submission | R ringkasan | - |
| CBT | R | C/R/U/D | C/R/U/D | - | - | take exam | - | - |
| Keuangan | R | R/report | - | C/R/U/D | - | R tagihan sendiri | R tagihan anak | - |
| SPMB | R | C/R/U/D | - | R biaya | C/R/U | - | - | C/R status sendiri |
| CMS | C/R/U/D | C/R/U/D | - | - | - | - | - | - |
| Broadcast/integrasi | C/R/U/D | C/R/U | - | - | R status | - | - | - |
| Audit/export | R | R sesuai scope | R own scope | R finance | R ops | R own | R child | R own |

Implementasi memakai permission granular, misalnya `students.read`, `students.update`, `grades.publish`, `finance.receipts.issue`, `spmb.accept`, dan bukan hanya pemeriksaan nama role.

### 3.3 Session dan route behavior

- Guard memisahkan session admin/staff, student, parent, dan SPMB.
- Setiap route memiliki middleware `auth`, guard, permission/policy, dan status-account check.
- Redirect setelah login ditentukan server berdasarkan role, bukan input role dari form.
- Role tidak boleh dipilih bebas untuk menaikkan privilege.
- Session ID diregenerasi setelah login; logout me-revoke session/token terkait.
- Inactivity timeout 30 menit; aksi sensitif dapat meminta re-authentication.
- Semua unauthorized access mengembalikan 403 atau redirect aman tanpa membocorkan keberadaan record.

## 4. Konvensi Data dan Kontrak Umum

### 4.1 Konvensi

- Primary key: UUID atau ULID; keputusan final dicatat pada technical design.
- Timestamp disimpan UTC; tampilan menggunakan timezone sekolah yang dapat dikonfigurasi.
- Semua entity memiliki `created_at`, `updated_at`; entity mutable penting memiliki `created_by`, `updated_by`.
- Soft delete hanya untuk entity yang membutuhkan histori; transaksi, audit, submission, dan hasil ujian tidak dihapus fisik melalui UI.
- List mendukung pagination default 25, max 100, filter, sort allowlist, dan query server-side.
- Mutation mengembalikan flash/toast yang aman dan state terbaru; error validasi terikat ke field.
- API JSON menggunakan envelope `{data, meta, errors, request_id}` dan HTTP status standar.

### 4.2 Error code minimum

| Code | Makna |
|---|---|
| `AUTH_REQUIRED` | Session/credential tidak valid |
| `FORBIDDEN` | Tidak punya permission atau relasi data |
| `VALIDATION_FAILED` | Input tidak memenuhi aturan |
| `NOT_FOUND` | Resource tidak ditemukan atau tidak boleh diungkap |
| `CONFLICT` | Duplikasi/state berubah/optimistic lock gagal |
| `RATE_LIMITED` | Melebihi batas request |
| `SCHEDULE_CLOSED` | Operasi di luar window waktu |
| `FILE_INVALID` | Tipe, ukuran, atau scan file gagal |
| `INTEGRATION_UNAVAILABLE` | Provider eksternal tidak tersedia |
| `RETRY_LATER` | Job/asynchronous processing belum selesai |

## 5. Auth, RBAC, dan System Settings

### 5.1 Auth behavior

**Precondition:** akun aktif, role terdaftar, guard sesuai.

**Main flow:** pengguna mengirim identifier + credential; server memvalidasi rate limit, credential, status, MFA/OTP bila berlaku; session diregenerasi; audit login dibuat; user diarahkan ke portal.

**Alternate/error:** credential salah menambah counter dan memberi pesan generik; akun terkunci sementara setelah threshold; reset password memakai signed, expiring, single-use token; OTP parent 6 digit berlaku 5 menit dan hanya sekali pakai.

**Validation:** email normalized; NISN exact format sesuai kebijakan sekolah; password minimal 12 karakter untuk akun internal; OTP numeric 6 digit; reset token tidak dapat digunakan ulang.

**Acceptance hooks:** test login setiap guard, privilege escalation, session fixation, rate limit, logout, timeout, password reset, OTP expiry/replay, dan audit event.

### 5.2 System settings

Mencakup identitas sekolah, logo/favicon, timezone, jam masuk, gateway WhatsApp, SMTP, SPMB open/close/test mode, feature switches, dan retention policy.

- Hanya `super_admin` dapat mengubah konfigurasi global.
- Secret API key/password disimpan encrypted dan tidak dikembalikan ke UI plain text.
- Save memakai optimistic lock/version; perubahan dicatat sebelum/sesudah secara masked.
- Test gateway mengirim pesan ke nomor yang dikonfirmasi, memakai queue dan tidak mengubah status aktif.
- SPMB test mode hanya bisa dipakai admin berpermission dan selalu memiliki banner/audit.

## 6. Data Dictionary dan Relasi Minimum

| Entity | Field minimum | Relasi/aturan |
|---|---|---|
| User | id, name, email/identifier, password_hash, status, last_login_at | Has roles, sessions, audit logs |
| Role/Permission | code, name, guard | Many-to-many dengan user |
| Student | id, nisn, nik encrypted, name, gender, birth data, photo, status | Belongs class/year; has parent links |
| Parent | id, name, phone encrypted, email, status | Many-to-many Student melalui guardian |
| AcademicYear | id, label, start/end, active | Satu active per school; histori immutable |
| Class/Major | id, name, grade, major, academic_year_id | Has students and schedules |
| Subject | id, code, name, weight | Has teachers, schedules, grades |
| Schedule | id, class, subject, teacher, day, start/end, room | Overlap validation |
| Attendance | id, student, date, time_in/out, status, source, operator, device | Unique student/date/session; immutable event log |
| KtsTemplate | id, colors, visibility, watermark, version | Versioned; references school config |
| KtsIssue | id, student, template_version, qr_payload_hash | Revocation/version support |
| Material | id, class/subject, title, file_key, mime, size, visibility | Private signed access |
| Assignment | id, class, subject, title, deadline, rubric, status | Has submissions |
| Submission | id, assignment, student, file_key, submitted_at, status, grade, feedback | Unique assignment/student/version |
| Exam | id, schedule, class, subject, start/end, duration, status | Has questions and attempts |
| Question | id, exam/bank, type, options, answer_hash, weight | Answer key restricted to teacher/system |
| ExamAttempt | id, exam, student, started_at, server_deadline, submitted_at, status | One active attempt per policy |
| ExamAnswer | attempt, question, answer, saved_at | Upsert/idempotent |
| Grade | id, student, subject, assessment_type, score, status, published_at | History/version and publisher |
| LibraryBook | id, title, author, publisher, isbn, year, category, physical_stock, ebook_key | Search indexed |
| SppItem | id, code, name, fee, frequency, active | Has invoices |
| Invoice | id, student, item, period, amount, due_at, status | Unique student/item/period |
| Payment | id, invoice, amount, method, reference, paid_at, receipt_id | Immutable financial record |
| BankAccount | id, bank, account_masked, holder, active | Secret/account number protected |
| CashTransaction | id, type, category, amount, transaction_at, proof, pic | Audit and period reports |
| SpmbWave | id, name, quota, open/close, fee, status | Date/availability rules |
| SpmbApplication | id, registration_no, applicant, status, rejection_note | State transition policy |
| SpmbDocument | id, application, type, file_key, verification_status | Private file + audit |
| Announcement | id, title, body, audience, publish_at, expires_at, status | Realtime event on publish |
| CmsPost/Gallery | id, slug, title, body/media, category, tags, SEO, status | Draft/review/published workflow |
| Notification | id, channel, recipient, template, status, provider_ref, attempts | Delivery audit |
| AuditLog | id, actor, action, entity, entity_id, before/after masked, ip, request_id | Append-only |
| SchoolSetting | key, encrypted/value, version, updated_by | Key allowlist |

## 7. KTS dan Presensi

### 7.1 KTS

- Admin memilih siswa aktif dan template version.
- Card layout menjaga rasio ISO CR-80 85,6 × 54 mm pada print CSS.
- Required visible data: logo, photo, NISN, NIK sesuai policy masking, name, class, major.
- QR payload minimal berisi identifier verifikasi non-sensitive/NISN policy; payload ditandatangani atau diverifikasi server, bukan data bebas yang dipercaya client.
- Preview menggunakan data tersimpan; download menghasilkan PDF/image actual; print menyediakan print stylesheet dan ukuran fisik.
- Template builder menyimpan version baru; template aktif tidak diubah secara destructive.

**Errors:** student inactive/not found, photo invalid, template incomplete, PDF generation failed.

### 7.2 Presensi

**Precondition:** operator/guru authorized, academic session aktif, scanner permission granted.

**Main flow:** kamera `getUserMedia`/barcode input membaca QR; decoder menghasilkan payload; server memvalidasi signature/student/session; duplicate lock dicek; server timestamp dan timezone menentukan `Hadir`/`Terlambat`; attendance disimpan; event `AttendanceRecorded` dipublish; notification job dibuat.

**Manual fallback:** hanya role berpermission, wajib reason, status, operator, dan audit.

**Validation:** payload invalid, student inactive, duplicate scan, outside school/session, invalid date/time, missing class.

**Report:** filter class/date range/status, daily/monthly aggregation, export CSV/PDF; no client-only filtering for authorized reports.

**Acceptance hooks:** scan under 1 second at P95 under target load, duplicate prevention, clock/timezone, camera denial fallback, notification event, range report, audit.

## 8. WhatsApp, Email, dan Notifications

- Provider adapter memiliki interface `sendMessage`, `checkHealth`, `normalizeError`.
- Provider selection dan fallback berasal dari encrypted settings; secret tidak masuk log.
- Notification record dibuat sebelum dispatch; statuses `pending`, `processing`, `sent`, `failed`, `cancelled`.
- Retry exponential dengan max attempts; dead-letter/failed view untuk admin.
- Idempotency key mencegah duplicate presensi/OTP/broadcast.
- OTP menyimpan hash, expiry, consumed_at, purpose, recipient; kode tidak disimpan/dikirim ulang dari UI.
- Broadcast memiliki recipient snapshot, consent/eligibility, batching, rate limit, progress, cancel policy, dan audit.
- Email reset/password dan SMTP test mengikuti queue dan delivery log.
- Realtime UI menampilkan status terbaru tetapi polling/manual refresh menjadi fallback.

**Acceptance hooks:** provider down, timeout, rate limit, retry, duplicate job, partial broadcast, OTP replay/expiry, test message isolation, audit.

## 9. Academic, Parent, dan Student Portal

### 9.1 Academic

- Academic year dapat dibuat/diaktifkan; tidak boleh menghapus histori yang sudah memiliki transaksi/grade.
- Class/major/subject/schedule memiliki overlap and referential validation.
- Bulk grading menerima satu batch dengan validasi per student; preview invalid rows; commit atomic atau per-row result yang jelas; version/publish workflow.
- Announcement audience dan publish window menentukan portal yang menerima data.

### 9.2 Parent portal

- Parent hanya dapat melihat linked student melalui policy/query scope.
- Empat tab wajib: attendance, grades, SPP, schedule/announcement.
- KTS dan contact WhatsApp memakai resource yang authorized dan URL/provider config yang valid.
- Realtime event memperbarui tab; stale/loading/error state harus terlihat.

### 9.3 Student portal/LMS

- Mobile-first widths 375/390/480; bottom navigation: Beranda, Jadwal, Tugas, Nilai, Profil.
- Materials mendukung PDF, DOC/DOCX, PPT/PPTX, video sesuai allowlist MIME, max size, virus scan, signed download URL, dan access scope.
- Assignment upload memakai multipart file input, checksum, size/type validation, deadline/late policy, retry-safe submission, and submission receipt.
- Status assignment: `not_started`, `submitted`, `late`, `graded`, `returned`.
- Student hanya dapat melihat material/task/grade milik class dan dirinya.

## 10. CBT

### 10.1 Authoring dan schedule

- Guru/Admin membuat exam untuk class/subject, question set, answer key, weight, duration, start/end, attempt policy.
- Publish melakukan validation: question lengkap, key valid, schedule valid, target class non-empty.
- Answer key tidak pernah dikirim ke browser sebelum grading server.

### 10.2 Attempt

1. Server memeriksa enrollment, exam published, current time dalam window, attempt limit, dan account status.
2. Server membuat attempt dengan `server_deadline`.
3. Client menampilkan countdown dari server timestamp; reconnect melakukan resync.
4. Setiap jawaban di-upsert dengan sequence/version dan queued autosave; UI menampilkan saved/saving/error.
5. Submit manual meminta konfirmasi; timeout melakukan server-side auto-submit.
6. Grading dijalankan aman/idempotent; result disimpan dan dipublish sesuai policy.

**States:** `draft -> published -> open -> in_progress -> submitted -> graded -> reviewed`; cancel/expired hanya melalui policy.

**Acceptance hooks:** outside schedule denied, refresh/reconnect recovery, autosave retry, stale attempt, timeout, duplicate submit, result accuracy, answer-key confidentiality, concurrent load.

## 11. Library

- Admin mengelola metadata, physical stock, ebook file, category, and visibility.
- Search index mencakup title, author, category, ISBN; filter dan pagination server-side.
- PDF.js membaca private PDF melalui signed URL/token policy, dengan page navigation, zoom, loading, error, and access watermark.
- Borrow/return jika diaktifkan harus memakai transaction/stock lock dan audit; stok tidak boleh negatif.
- Download disabled/allowed mengikuti policy, bukan hanya menyembunyikan button.

## 12. Finance

- `SppItem` dan invoice distribution mendukung target class/grade/academic year, preview count, idempotent generation, dan reversal policy.
- SPP 12 periode mendukung `unpaid`, `partial`, `paid`, `overdue`, serta alokasi pembayaran.
- Payment mutation atomic; reference/receipt unique; correction dilakukan reversal/adjustment, bukan edit diam-diam.
- Bank account menyimpan data sensitif masked/encrypted dan hanya terlihat role finance.
- Receipt PDF memiliki nomor, school identity, student, item, period, amount, method, issuer, timestamp, verification code.
- Cash reports mendukung monthly/yearly balance, income/expense, opening/closing balance, filter, export, and reconciliation status.

**Acceptance hooks:** duplicate invoice/payment, partial payment, reversal, concurrent payment, receipt rendering, period close, unauthorized finance access, report totals.

## 13. SPMB

- Admin mengatur wave quota/open-close/fee/requirements.
- Applicant account dapat menyimpan setiap step sebagai draft; server melakukan optimistic version check.
- Upload berkas private, MIME/size/virus validation, checksum, replacement history, and verification audit.
- Status: `draft -> submitted -> verified -> accepted|rejected`; `rejected -> resubmitted` hanya sesuai policy; terminal transition membutuhkan permission.
- Rejection wajib memiliki reason; applicant hanya melihat status dan reason yang dipublikasikan.
- Accepted-to-student conversion adalah job idempotent dengan unique application/student link, account creation, class placement, audit, and failure reconciliation.
- Proof PDF hanya dapat diterbitkan untuk application yang valid dan memiliki nomor resmi.

## 14. CMS Public

- Content workflow: `draft -> review -> published -> archived`; slug unique and redirect policy tersedia.
- Admin CRUD post/category/tag/cover/gallery/album/profile/program/agenda/social/map.
- Public hanya melihat published content dalam window aktif; HTML disanitasi; media dioptimalkan.
- SEO fields: title, description, canonical, OG image, slug, structured data bila relevan.
- Lighthouse SEO target ≥90; halaman publik harus memiliki metadata, semantic heading, alt text, sitemap/robots, dan friendly 404.

## 15. API, Livewire Actions, Event, dan Job Contract

### 15.1 HTTP/API baseline

| Method/route | Auth | Purpose | Validation/response |
|---|---|---|---|
| `POST /login/{guard}` | Public | Login per guard | Rate limit; session/redirect |
| `POST /logout` | Auth | Revoke session | 204/redirect |
| `POST /password/forgot` | Public | Request reset | Generic response; queued email |
| `POST /otp/request` | Parent | Request OTP | 6 digit, expiry, rate limit |
| `POST /otp/verify` | Parent pending | Verify OTP | Single-use, session creation |
| `POST /attendance/scans` | Operator/Guru | Record scan | Idempotency, duplicate conflict |
| `GET /attendance/reports` | Admin/Guru | Report | Scoped filters/pagination/export job |
| `POST /materials/{id}/download` | Student/Guru scoped | Issue signed URL | Access/expiry audit |
| `POST /assignments/{id}/submissions` | Student scoped | Upload submission | Multipart, deadline, checksum |
| `POST /exams/{id}/attempts` | Student scoped | Start attempt | Schedule/attempt policy |
| `PUT /attempts/{id}/answers/{question}` | Student attempt | Autosave answer | Version/idempotency |
| `POST /attempts/{id}/submit` | Student attempt | Submit exam | Confirm/server grade job |
| `POST /payments` | Bendahara | Record payment | Transaction/idempotency |
| `POST /spmb/applications/{id}/transition` | Admin | Change status | State policy/reason |
| `GET /notifications/{id}` | Scoped auth | Delivery detail | Recipient scope |

Actual routes may be Livewire actions, but equivalent authorization, validation, status, and audit behavior wajib ada.

### 15.2 Realtime events/channels

| Event | Channel | Consumer |
|---|---|---|
| `AttendanceRecorded` | private `school.attendance` / parent child | Operator, parent |
| `NotificationDeliveryUpdated` | private recipient/admin log | Admin/recipient |
| `AnnouncementPublished` | private audience | Student/parent/staff |
| `GradePublished` | private student/parent | Student/parent |
| `SpmbStatusUpdated` | private application | Applicant/admin |
| `ExamAttemptSaved/Submitted` | private attempt | Student/teacher |
| `PaymentRecorded` | private student/parent/finance | Parent/finance |

Channel authorization selalu memeriksa school scope, role, dan relation to entity.

### 15.3 Queue jobs dan retry

`SendNotification`, `SendOtp`, `ProcessBroadcastBatch`, `GeneratePdf`, `IndexLibraryBook`, `ScanUploadedFile`, `ProcessImport`, `GradeExam`, `ConvertAcceptedApplicant`, `RunBackup`, dan `PruneExpiredFiles` wajib memiliki retry/backoff, timeout, unique/idempotent key, failure logging, and dashboard visibility.

## 16. File, PDF, QR, dan Security Controls

- Upload allowlist per feature, max size, extension/MIME/content validation, virus scan, checksum, private disk, generated safe name, and retention.
- Signed URLs short-lived and bound to authorized resource; revoked submission/file cannot be accessed.
- PDF generation server-side uses fixed templates, escaped content, font fallback, page/print dimensions, and generated verification number.
- QR verification endpoint rate-limited, validates signature/expiry/revocation, and returns minimum necessary data.
- NIK, phone, SMTP secret, provider key, and bank account encrypted at rest; UI masks by default.
- Password Argon2id/bcrypt per supported framework policy; CSRF, CSP, HSTS, secure cookies, SameSite, XSS escaping, SQL parameterization, and login/OTP/API throttling.
- Audit log captures actor, action, target, timestamp, request ID, IP/device where policy allows, and masked before/after values.

## 17. UI/UX, Accessibility, dan Responsive Contract

- Semantic landmarks, heading hierarchy, label/input association, keyboard access, visible focus, skip link, error summary, and live region for async feedback.
- Contrast minimum WCAG 2.1 AA; do not use color alone for status.
- Responsive acceptance widths: 375, 390, 480, 768, 1024, 1440, and 1920 px; no horizontal clipping on primary flows.
- `prefers-reduced-motion` disables non-essential animations.
- Touch targets minimum 44 × 44 CSS px on mobile; destructive action confirmation and undo/reversal behavior where applicable.
- Every data view has loading, empty, error, permission denied, stale/offline, and retry states.
- Form behavior preserves entered values after validation errors and explains file/format/permission constraints.

## 18. Observability, Backup, dan Operations

- Structured JSON logs to stderr/stdout with request ID, user/role (non-sensitive), route/action, duration, status, and exception class.
- Health endpoints: liveness `/up`, readiness for DB/Redis/queue/provider dependencies without leaking secrets.
- Metrics: request latency/error, queue depth/failure, notification delivery, scan latency, CBT autosave, storage, DB slow queries, backup status.
- Alerts for repeated login failures, provider outage, failed jobs, backup failure, disk/storage threshold, and availability breach.
- Daily encrypted database/file backup, offsite copy, retention policy, checksum, restore drill; target RPO ≤1 hour and RTO ≤4 hours unless DEC updates it.
- Horizon/Reverb/admin operational dashboards protected by role/network policy.

## 19. Migration, Seed, dan Import

- Migration order follows dependencies and is reversible in non-production.
- Demo seed uses synthetic data only; no real NIK/phone/password.
- CSV/XLSX import is staged: upload -> parse -> preview -> validate -> approve -> commit; invalid rows downloadable; duplicate matching rules explicit.
- Data migration preserves source ID, import batch, operator, timestamp, and error report.
- Destructive migration or academic-year close requires backup and confirmation.

## 20. QA Test Matrix

| Area | Minimum scenarios | Evidence |
|---|---|---|
| Auth/RBAC | All guards, wrong credential, lockout, reset, OTP expiry/replay, route matrix | Feature/security tests |
| Data integrity | Duplicate, concurrent update, transaction rollback, foreign key, idempotency | Integration tests |
| Attendance | Camera permission, valid/invalid QR, duplicate, timezone, range report, WA event | Browser + integration |
| LMS/files | MIME/size/virus, signed URL, deadline, retry, unauthorized download | Browser/security |
| CBT | Schedule, resync, autosave, refresh, timeout, duplicate submit, grading | Load + browser |
| Finance | Invoice distribution, partial payment, receipt, reversal, report totals | Feature/PDF tests |
| SPMB | Draft resume, upload, review, rejection, conversion retry | Feature/browser |
| CMS | Publish workflow, XSS sanitization, SEO, responsive, 404 | Lighthouse/accessibility |
| Realtime | Channel authorization, event delivery, reconnect, polling fallback | Integration/load |
| Accessibility | Keyboard, focus, screen reader labels, contrast, reduced motion | axe/manual |
| Operations | Backup/restore, health, failed jobs, rate limits, alerts | Runbook/drill |

## 21. Requirement-to-Test Traceability

| FRD section | PRD IDs | QA evidence |
|---|---|---|
| Auth/RBAC | AUTH-001..009, SYS-001..004 | Auth/RBAC feature + security suite |
| KTS | KTS-001..005 | QR decode + print/PDF + visual test |
| Attendance | ATT-001..006, WA-003 | Camera/browser + integration/load |
| Notifications | WA-001..006 | Provider contract + queue/retry tests |
| Parent | PRT-001..007 | Scoped data + realtime browser tests |
| LMS | LMS-001..005 | Responsive + file/security tests |
| CBT | CBT-001..007 | Schedule/timer/autosave/load tests |
| Library | LIB-001..004 | Search/PDF/stock integration tests |
| Finance | FIN-001..007 | Accounting invariants/PDF/report tests |
| SPMB | SPMB-001..007 | Workflow/upload/idempotency tests |
| Academic | ACD-001..005 | History/bulk grading/publish tests |
| CMS | CMS-001..006 | CMS CRUD/SEO/Lighthouse tests |
| NFR | NFR-001..012 | CI, axe, Lighthouse, load, backup drills |

## 22. Open Technical Decisions

| ID | Decision | Owner | Status |
|---|---|---|---|
| TDEC-001 | UUID vs ULID primary keys | Tech lead | TBD |
| TDEC-002 | Exact guards vs single guard with scoped policies | Tech lead/Security | TBD |
| TDEC-003 | QR payload signing and verification format | Security/Backend | TBD |
| TDEC-004 | Primary/fallback WhatsApp provider and rate limits | Super Admin/IT | TBD |
| TDEC-005 | Virus scanning service and max file sizes | IT | TBD |
| TDEC-006 | Payment reconciliation/manual verification workflow | Bendahara/IT | TBD |
| TDEC-007 | Realtime fallback polling intervals | Product/IT | TBD |
| TDEC-008 | Backup retention and offsite provider | IT | TBD |
| TDEC-009 | Browser support matrix for camera/PDF/PWA | QA/UX | TBD |
| TDEC-010 | Production hosting and object storage region | IT | TBD |

---

*Perubahan pada FRD harus menjaga kompatibilitas traceability dan disetujui technical owner serta product owner.*
