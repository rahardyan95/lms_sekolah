#!/bin/sh
set -e
# Tunggu Postgres siap (max ~60 dtk), lalu migrate + cache + exec CMD.
# Di dev (APP_ENV!=production): config clear agar .env bind-mount terbaca live.
# Di production: config/route/view cache untuk performa.

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] waiting for postgres ${DB_HOST}:${DB_PORT}..."
i=0
until php -r '$c=@fsockopen(getenv("DB_HOST")?: "db", (int)(getenv("DB_PORT")?:5432)); if($c){fclose($c); exit(0);} exit(1);' 2>/dev/null || [ $i -ge 60 ]; do
  i=$((i+1))
  sleep 1
done

echo "[entrypoint] running migrations..."
if [ "${APP_ENV}" = "production" ]; then
  echo "[entrypoint] production guard: validating secrets..."
  for v in APP_KEY DB_PASSWORD REDIS_PASSWORD MEILI_MASTER_KEY SANCTUM_TOKEN_EXPIRATION; do
    val="$(printenv "$v")"
    if [ -z "$val" ]; then
      echo "[entrypoint] FATAL: $v kosong di production. Isi dari .env prod (lihat .env.prod.example)." >&2
      exit 1
    fi
  done
  case "$DB_PASSWORD:$REDIS_PASSWORD:$MEILI_MASTER_KEY" in
    *secret*|*password123*|*meiliMasterKey123*|*changeme*|*GANTI_*)
      echo "[entrypoint] FATAL: secret masih default/contoh. Ganti DB_PASSWORD/REDIS_PASSWORD/MEILI_MASTER_KEY." >&2
      exit 1
      ;;
  esac
  if [ "${APP_DEBUG}" = "true" ]; then
    echo "[entrypoint] FATAL: APP_DEBUG=true di production." >&2
    exit 1
  fi
  php artisan app:readiness || {
    echo "[entrypoint] FATAL: app:readiness gagal. Batalkan boot agar tidak go-live setengah aman." >&2
    exit 1
  }
fi
php artisan migrate --force

if [ "${APP_ENV}" = "production" ]; then
  echo "[entrypoint] caching config/route/view..."
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
else
  php artisan config:clear || true
fi

echo "[entrypoint] starting: $@"
exec "$@"
