# SIAKAD & LMS Sekolah Terpadu

Sistem Informasi Akademik & LMS untuk sekolah (SMK) — backend **Laravel 13** (REST API) + frontend **React 19 / Vite / Tailwind v4**, berjalan penuh di **Docker Compose** (Postgres, Redis, Meilisearch, Mailpit, queue, scheduler).

> Status: **fondasi produksi** — auth/RBAC, master siswa, dan presensi (QR + notifikasi WhatsApp) aktif; modul domain lain menyusul sesuai roadmap di `docs/PRD.md`. Lihat `docs/DEPLOY.md` dan `docs/AUDIT_FULLSTACK_UX_MOBILE_QA_OOP.md`.

## Struktur

```
app/            Backend Laravel (Controllers/Api/V1, Services, Contracts, Policies, Models, Enums)
client/         Frontend React SPA (src/components/modules/*, services, lib)
docs/           BRD, PRD, FRD, DEPLOY, laporan audit
client.md       Kebutuhan produk 13 modul
database/       Migrasi & seeder (RolePermissionSeeder — akun demo tidak dibuat di production)
routes/api.php  REST API v1 (auth:sanctum + rate limit + policy)
skill/          Referensi skill (UI/UX, security, QA) untuk agent — bukan kode runtime
```

## Menjalankan (dev)

```bash
cp .env.example .env
docker compose up --build -d          # otomatis gabung docker-compose.override.yml (vite :5173)
docker compose exec backend php artisan migrate:fresh --seed --force
```

- Frontend dev: http://localhost:5173 · API: http://localhost:8000/up · Mailpit UI: http://localhost:8025
- Kredensial demo dev (password uniform `SEED_DEMO_PASSWORD`, default `password123` — hanya di luar production):
  `superadmin|admin|guru|bendahara|operator@sekolah.sch.id` (tab Staff),
  NISN `0071829384` (tab Siswa),
  NISN `0071829384` + OTP WhatsApp (tab Orang Tua; DEV: pakai `debug_code`),
  `SPMB-2026-0089` (tab SPMB).
- Halaman login punya panel **Akun Demo (DEV)**: satu klik per peran (8 tombol) yang mengisi kredensial
  dan langsung masuk. Dirender hanya saat Vite DEV; sandi diambil dari `VITE_DEMO_PASSWORD`
  (default `password123`, harus sama dengan `SEED_DEMO_PASSWORD`).
- Landing/CMS publik tetap terbuka tanpa login; dashboard & semua menu wajib login (session restore via `GET /api/v1/me`).

## Verifikasi sebelum rilis

```bash
docker compose ps                                  # semua healthy
docker compose exec backend php artisan test       # 182 passed (hermetic, sqlite :memory:)
docker compose exec -T frontend ./node_modules/.bin/tsc -b
docker compose exec -T frontend npm run build
cd client && npx playwright test                   # 14 passed (login 8 role, modul, routing, CSRF, alur tulis)
```

## Produksi (ringkas — detail di `docs/DEPLOY.md`)

1. Di server: `cp .env.prod.example .env` → isi `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`, `MEILI_MASTER_KEY`, `SANCTUM_TOKEN_EXPIRATION`, `TRUSTED_PROXIES`, SMTP, domain `APP_URL/FRONTEND_URL/VITE_API_URL/CORS_*`.
2. `docker compose -f docker-compose.yml up --build -d` (base compose = aman produksi: port infra tidak dipublish, Redis requirepass aktif saat `REDIS_PASSWORD` diisi).
3. TLS di reverse proxy depan port 8080/8000 + backup harian `pg_dump` (target RPO ≤1 jam / RTO ≤4 jam).

## Dokumentasi

- `docs/BRD.md`, `docs/PRD.md`, `docs/FRD.md` — kebutuhan & traceability per modul
- Keputusan go-live terkunci 11 Sep 2026: WA primary Fonnte + fallback Wablas, rekonsiliasi manual + nomor referensi, nilai guru-submit/wali-publish — lihat `docs/PRD.md` §16
- `docs/DEPLOY.md` — operasional dev/VPS + checklist verifikasi rilis
- `docs/AUDIT_FULLSTACK_UX_MOBILE_QA_OOP.md` — audit evidence-based multi-perspektif
