# Berita Acara Drill Restore

## Drill #1 — 10 Sep 2026 (stack dev lokal, Postgres 17)

- Backup: `php artisan db:backup` → `db-20260910-142647.sql.gz` (12,1 KB), `gzip -t` OK.
- Restore: database sementara `lms_restore_drill` (tanpa menyentuh data live),
  import via `gunzip | psql`, lalu banding row-count per tabel inti.
- Hasil perbandingan live vs drill: users 8=8, students 1=1, attendances 1=1,
  cbt_attempts 1=1, invoices 1=1, spmb_applications 0=0 — **IDENTIK**.
- Cleanup: database drill di-drop, file salinan dihapus.
- Durasi terukur (backup→verify→restore→compare→cleanup): ±4 menit pada data kecil.
- RTO terhadap target ≤4 jam: **TERPENUHI** (observasi skala kecil).
- RPO: backup harian → RPO ≤24 jam (target ≤1 jam HANYA tercapai bila
  backup per-jam / WAL archiving aktif — lihat tindak lanjut).

## Status tindak lanjut RPO (11 Sep 2026)

1. ✅ **Backup tiap jam aktif**: `bootstrap/app.php` menjadwalkan
   `db:backup --keep=48` pada menit ke-5 tiap jam (retensi lokal 48 file ≈ 2 hari).
   `app:monitor --max-backup-hours=2` kini memperingatkan bila backup mandek >2 jam.
2. ✅ **Offsite wajib**: `scripts/backup.sh` menolak jalan (exit 1) bila
   `BACKUP_S3_BUCKET` kosong, dan `app:readiness` memberi WARN bila bucket belum diisi.
3. ⏳ **Drill #2 di VPS produksi** (setelah data riil) tetap perlu dijalankan untuk
   memvalidasi RPO ≤1 jam + restore dari salinan offsite.

Dengan (1) dan (2) aktif, RPO lokal = **≤1 jam** secara desain; klaim final tetap
menunggu Drill #2 di VPS.

## Drill #2 — 11 Sep 2026 (stack dev lokal, Postgres 17, data seed)

- Backup: `php artisan db:backup` → `db-20260911-082002.sql.gz` (10,2 KB), `gzip -t` OK.
- Restore: database sementara `lms_restore_drill2` (tanpa menyentuh data live),
  import via `zcat | psql`, lalu banding row-count per tabel inti.
- Hasil perbandingan live vs drill: users 8=8, students 1=1, attendances 0=0,
  invoices 1=1, spmb_applications 0=0, cbt_attempts 0=0, broadcasts 0=0 — **IDENTIK**.
- Cleanup: database drill di-drop, salinan `/tmp/drill2.sql.gz` dihapus.
- Durasi terukur (backup→verify→restore→compare→cleanup): ±3 menit pada data kecil.
- RTO terhadap target ≤4 jam: **TERPENUHI** (observasi skala kecil).
- Catatan: Drill #2 offsite VPS (restore dari salinan S3) tetap wajib setelah
  `BACKUP_S3_BUCKET` terisi di server produksi.
