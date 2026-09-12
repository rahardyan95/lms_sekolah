# DEPLOY — LMS Sekolah (Production-Ready)

Scope: 13 modul `client.md` punya backend API + test; UI server-first
dengan fallback mock DEV. Modul: Auth/RBAC, KTS signed-QR, Presensi,
WA broadcast, Portal Ortu, LMS, CBT server-side, Library, Finance,
SPMB, Akademik, CMS, Settings (lihat `docs/PRD.md` Phase 2-5 untuk NFR lanjutan:
load test, axe a11y, Lighthouse, drill restore).

## 1. Perintah

```bash
# DEV lokal (auto-load docker-compose.yml + .override.yml) — vite di 5173
docker compose up --build -d
docker compose exec backend php artisan migrate:fresh --seed --force

# PROD simulasi lokal (tanpa override = image prod, nginx di 8080)
docker compose -f docker-compose.yml up --build -d
```

Jangan `docker system prune -a` di mesin ini — ada project lain
(`infrastructure-*`, `saas-*`, `ticketing-*`). Cleanup scoped saja:

```bash
docker compose down -v --remove-orphans
docker rmi lms_sekolah-backend lms_sekolah-frontend
```

## 2. VPS

1. `cp .env.prod.example .env` di server, isi `APP_KEY`
   (`php artisan key:generate --show`), password DB, `MEILI_MASTER_KEY`,
   SMTP, dan domain pada `APP_URL / FRONTEND_URL / VITE_API_URL /
   CORS_ALLOWED_ORIGINS / SANCTUM_STATEFUL_DOMAINS`.
2. `VITE_API_URL` di-bake saat build frontend — ganti domain = rebuild frontend.
3. TLS: pastikan DNS `API_HOST` + `FRONTEND_HOST` mengarah ke VPS, port
   80+443 terbuka, `CADDYFILE=Caddyfile.prod` + `ACME_EMAIL` terisi.
   Caddy menerbitkan sertifikat otomatis (volume `caddy_data`).
4. `docker compose -f docker-compose.yml up --build -d`
5. Verifikasi: `curl -f https://api.sekolah.sch.id/up`,
   `curl -f https://sekolah.sch.id/health`,
   `docker compose exec backend php artisan app:readiness` (harus 13/13 PASS).
6. Backup harian `pg_dump` + volume `storage_data`, drill restore berkala
   (target RPO ≤1h / RTO ≤4h).

## 3. Catatan operasi (pelajaran dari build ini)

- Entrypoint backend: tunggu Postgres → `migrate --force` → dev:
  `config:clear`, production: `config/route/view:cache`.
- `artisan serve` + opcache `validate_timestamps=0`: setiap deploy kode BARU
  wajib container baru (image rebuild) atau `docker compose restart backend
  queue scheduler`. Jangan edit kode lalu berharap langsung termuat di prod.
- Queue `queue:work` + `schedule:work` wajib jalan (notifikasi presensi,
  OTP cleanup). Cek `php artisan queue:failed` = 0.
- Rate limit: `throttle:auth` 10/15 mnt per IP (login/OTP/forgot),
  `throttle:api` 300/mnt. Suite test hermetic (sqlite `:memory:`,
  cache array) via `tests/TestCase.php` + `phpunit.xml force="true"`.
- `debug_code` OTP hanya muncul saat `local/testing/unit-test` —
  tidak pernah di production.
- Reset password mengirim email link ke `FRONTEND_URL/reset-password`
  (frontend menyediakan halaman itu).
- Code-splitting per modul via `ModuleLoader` (`React.lazy` + `Suspense` +
  `ModuleErrorBoundary`) — index ~298 kB, chunk modul 10-29 kB.

## 4. Verifikasi rilis (harus hijau semua)

```bash
docker compose ps                       # semua healthy (frontend dev: running)
curl -f http://localhost:8000/up
curl -f http://localhost:5173/          # dev; prod: :8080/health
docker compose exec backend php artisan test   # 182 passed (794 assertions)
docker compose exec -T frontend ./node_modules/.bin/tsc -b
curl -s http://localhost:8025/api/v1/messages  # mailpit (dev)
```

Kredensial seed dev (8 akun, password uniform `SEED_DEMO_PASSWORD`, default
`password123` — hanya di luar production; di production seeder melewati akun demo):
staff `superadmin|admin|guru|bendahara|operator@sekolah.sch.id`,
siswa NISN `0071829384`, orang tua NISN `0071829384` + OTP,
calon siswa `SPMB-2026-0089`. Verifikasi login 8 role:
`php artisan test --filter DemoAccountTest`.

Panel **Akun Demo (DEV)** pada halaman login menyediakan satu tombol per peran
(isi + masuk otomatis). Panel dirender hanya saat Vite DEV dan sandinya dari
`VITE_DEMO_PASSWORD` (default `password123`); bukan artefak produksi.
