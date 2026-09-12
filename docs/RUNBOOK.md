# RUNBOOK — Operasi Produksi LMS Sekolah

## 1. Deploy pertama (VPS)

1. SSH, install Docker + Compose v2, buka port 80/443.
2. `git clone <repo> && cd lms_sekolah`
3. `cp .env.prod.example .env`, isi: `APP_KEY` (`php artisan key:generate --show`
   via container sementara — WAJIB fresh, jangan pakai APP_KEY dari env dev),
   `DB_PASSWORD`, `REDIS_PASSWORD`, `MEILI_MASTER_KEY`,
   `SANCTUM_TOKEN_EXPIRATION=120`, `TRUSTED_PROXIES=*`, SMTP, `APP_URL/FRONTEND_URL/
   VITE_API_URL/CORS_*`, `CADDYFILE=Caddyfile.prod`, `API_HOST/FRONTEND_HOST/ACME_EMAIL`,
   serta gateway WhatsApp nyata (`WA_PROVIDER` ≠ log, `WA_ENDPOINT`, `WA_API_KEY`) —
   readiness menolak boot bila WA masih `log`.
4. DNS: A-record `API_HOST` + `FRONTEND_HOST` → IP VPS. Tunggu propagasi (`dig +short`).
5. `chmod +x scripts/*.sh && ./scripts/deploy.sh` — abort bila readiness gagal.
6. Bootstrap admin pertama (users kosong setelah deploy bersih):
   `docker compose exec backend php artisan admin:create --name="..." --email="..." --password="..."`
   (min. 12 karakter, huruf+angka) atau interaktif tanpa opsi.
7. Verifikasi: `curl -f https://$API_HOST/up`, `curl -f https://$FRONTEND_HOST/health`,
   login 1 akun/role via UI, `php artisan queue:failed` (= 0).

## 2. Deploy update (zero-downtime ringan)

1. `git pull`, `./scripts/deploy.sh` (rebuild image → container baru; opcache
   `validate_timestamps=0` mengharuskan container baru — jangan edit kode live).
2. Runtime HTTP produksi = **Laravel Octane + FrankenPHP** (container `backend`,
   target image `prod`). Reload kode tanpa ganti container: `php artisan octane:reload`
   (dipakai bila perlu), atau `octane:status` untuk cek server.
   Queue & scheduler tetap `php artisan` biasa (target image `cli`).
3. Bila `migrate`/readiness gagal: container sudah baru — rollback:
   `git checkout <tag-lama>`, `./scripts/deploy.sh`, lalu
   `php artisan migrate:rollback --step=N` bila migrasi baru sempat jalan
   (cek `migrate:status` dulu).

## 3. Backup & restore

- **Tiap jam** otomatis: `db:backup --keep=48` via scheduler (menit ke-5) →
  `storage/app/backups/` (volume). Retensi lokal 48 file ≈ 2 hari (RPO ≤1 jam).
- **Offsite wajib**: `BACKUP_S3_BUCKET` (+ `BACKUP_S3_ENDPOINT` bila non-AWS) di `.env`;
  jalankan `./scripts/backup.sh` (script gagal bila bucket kosong; `app:readiness`
  juga memberi WARN). Untuk backup lokal ad-hoc: `php artisan db:backup`.
- Restore/drill: `./scripts/restore.sh <file>` lalu isi `docs/DRILL_RESTORE.md`.

## 4. Insiden cepat

| Gejala | Cek | Aksi |
|---|---|---|
| 502/API mati | `compose ps`, `logs backend --tail 50` | `compose restart backend`; bila citra rusak → rollback §2 |
| Queue menumpuk | `queue:failed`, `logs queue` | `queue:retry all` / `queue:flush --hours=...` |
| Redis NOAUTH | `REDIS_PASSWORD` di `.env` vs container | samakan + `--force-recreate redis backend queue scheduler` |
| Cert kedaluwarsa | `schedule:monitor` alert / browser | pastikan port 80 terbuka, `compose restart caddy` |
| Disk penuh | `df -h`, `du -sh storage/` | prune backup lama, `docker system prune` (scoped) |

## 5. Rotasi secret

Ubah di `.env` → `--force-recreate` service terkait → `app:readiness` harus 16/16.
Jangan commit `.env` (untracked, ada di `.gitignore`).
