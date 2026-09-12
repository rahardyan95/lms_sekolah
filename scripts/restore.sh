#!/bin/sh
# Restore drill: pulihkan FILE backup ke database berjalan, lalu smoke test.
# Pakai: ./scripts/restore.sh storage/app/backups/db-YYYYMMDD-HHMMSS.sql.gz
# PERINGATAN: menimpa data DB aktif. Untuk drill, pakai stack staging/isolasi.
set -e

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "FATAL: file backup tidak ditemukan: $FILE" >&2
  exit 1
fi

gzip -t "$FILE" || { echo "FATAL: gzip korup" >&2; exit 1; }

echo "[restore] hentikan consumer (queue/scheduler)..."
docker compose stop queue scheduler

echo "[restore] terminate koneksi + recreate DB..."
docker compose exec -T db psql -U "${DB_USERNAME:-lms}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_DATABASE:-lms_sekolah}' AND pid<>pg_backend_pid();"
docker compose exec -T db psql -U "${DB_USERNAME:-lms}" -d postgres -c \
  "DROP DATABASE \"${DB_DATABASE:-lms_sekolah}\";"
docker compose exec -T db psql -U "${DB_USERNAME:-lms}" -d postgres -c \
  "CREATE DATABASE \"${DB_DATABASE:-lms_sekolah}\";"

echo "[restore] import..."
gunzip -c "$FILE" | docker compose exec -T db psql -U "${DB_USERNAME:-lms}" -d "${DB_DATABASE:-lms_sekolah}" -q

echo "[restore] migrate (jaga skema terbaru) + start consumer..."
docker compose exec -T backend php artisan migrate --force
docker compose start queue scheduler

echo "[restore] smoke: /up + login superadmin harus 200/portal..."
START=$(date +%s)
curl -sf http://localhost:8000/up -o /dev/null && echo "[restore] /up OK"
echo "[restore] SELESAI dalam $(( $(date +%s) - START )) dtk (+waktu import). Catat di docs/DRILL_RESTORE.md."
