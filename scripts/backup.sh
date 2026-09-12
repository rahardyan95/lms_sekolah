#!/bin/sh
# Backup + offsite untuk produksi: pg_dump via container backend, verifikasi gzip,
# lalu WAJIB upload ke S3-compatible (BACKUP_S3_BUCKET) agar RPO penuh terpenuhi.
# Backup lokal ad-hoc tanpa offsite: `php artisan db:backup` langsung di container.
#
# File backup hidup di NAMED VOLUME (storage_data → /var/www/html/storage/app),
# BUKAN di path host ./storage/app — file diambil dari container via compose cp.
set -e

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
  echo "FATAL: BACKUP_S3_BUCKET kosong — offsite wajib untuk RPO penuh (lihat docs/RUNBOOK.md §3)." >&2
  echo "       Untuk backup lokal saja (dev): docker compose exec backend php artisan db:backup" >&2
  exit 1
fi

echo "[backup] dump + verifikasi integritas di container..."
$COMPOSE exec -T backend php artisan db:backup --keep=48

echo "[backup] ambil file terbaru dari volume container..."
LATEST=$($COMPOSE exec -T backend sh -c "ls -t storage/app/backups/db-*.sql.gz 2>/dev/null | head -n 1")
if [ -z "$LATEST" ]; then
  echo "FATAL: tidak ada file backup di storage/app/backups container." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
$COMPOSE cp "backend:$LATEST" "$TMP/"
FILE="$TMP/$(basename "$LATEST")"
gzip -t "$FILE" && echo "[backup] OK: $FILE ($(du -h "$FILE" | cut -f1))"

echo "[backup] upload offsite s3://$BACKUP_S3_BUCKET..."
aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/lms-sekolah/" ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"}
echo "[backup] offsite OK"
