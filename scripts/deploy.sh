#!/bin/sh
# Deploy produksi: build → up → migrate → readiness gate.
# Gagal di langkah mana pun = abort (set -e), container lama tetap jalan
# bila build gagal; bila migrate/readiness gagal, jalankan rollback manual (RUNBOOK).
set -e

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "FATAL: .env tidak ada. Salin dari .env.prod.example lalu isi secret." >&2
  exit 1
fi

VITE_API_URL="$(grep -E '^VITE_API_URL=' .env | cut -d= -f2- | tr -d '\"')"
if [ -z "$VITE_API_URL" ]; then
  echo "FATAL: VITE_API_URL kosong di .env — bundle frontend akan fail-fast. Isi dulu (mis. https://api.sekolah.sch.id/api/v1)." >&2
  exit 1
fi

echo "[deploy] build images..."
$COMPOSE build

echo "[deploy] start stack..."
$COMPOSE up -d

echo "[deploy] verifikasi bundle frontend berisi VITE_API_URL..."
if ! $COMPOSE exec -T frontend sh -c "grep -qF '$VITE_API_URL' /usr/share/nginx/html/assets/*.js"; then
  echo "FATAL: bundle JS tidak berisi $VITE_API_URL — build-arg tidak masuk. Jangan go-live." >&2
  exit 1
fi

echo "[deploy] tunggu backend healthy (maks 120 dtk)..."
i=0
until $COMPOSE exec -T backend wget -qO- http://127.0.0.1:8000/up | grep -qi up || [ $i -ge 120 ]; do
  i=$((i + 1))
  sleep 1
done

echo "[deploy] migrate..."
$COMPOSE exec -T backend php artisan migrate --force

echo "[deploy] readiness gate..."
$COMPOSE exec -T backend php artisan app:readiness

echo "[deploy] status akhir:"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}"
echo "[deploy] SELESAI — pantau: queue:failed=0, TLS, /health."
