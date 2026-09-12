# ============================================================
# LMS Sekolah — Backend (Laravel 13 / PHP 8.4)
# Dua target image dari stage `vendor` yang sama:
#   * cli  → php-cli-alpine. Dev (artisan serve), queue, scheduler, test.
#   * prod → FrankenPHP + Laravel Octane (worker mode, konkuren).
# Prinsip: gagal cepat (no `|| true`), opcache on, non-root,
# migrate + cache via entrypoint, HEALTHCHECK bawaan.
# ============================================================

FROM composer:2 AS vendor
WORKDIR /build
COPY composer.json composer.lock ./
# Full install (termasuk dev) agar manifest package + artisan test jalan
# di image maupun saat bind-mount dev. Slimming dicapai via .dockerignore.
# gd hanya dipakai runtime; image composer tidak menyediakannya.
RUN composer install \
    --no-interaction --prefer-dist \
    --optimize-autoloader --no-scripts \
    --ignore-platform-req=ext-gd

# ------------------------------------------------------------
# Target CLI — dev (artisan serve), queue worker, scheduler, test
# ------------------------------------------------------------
FROM php:8.4-cli-alpine AS cli
WORKDIR /var/www/html

# System deps + PHP extensions (pdo_pgsql, redis, opcache, intl, zip, gd)
# postgresql-client: pg_dump untuk backup terjadwal (php artisan db:backup).
RUN apk add --no-cache --virtual .build-deps \
        postgresql-dev $PHPIZE_DEPS linux-headers \
    && apk add --no-cache postgresql-libs postgresql-client libzip-dev libpng-dev oniguruma-dev icu-dev \
    && docker-php-ext-install pdo pdo_pgsql mbstring zip gd intl pcntl bcmath opcache \
    && pecl install redis \
    && docker-php-ext-enable redis opcache \
    && apk del .build-deps \
    && rm -rf /tmp/* /var/cache/apk/*

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-lms.ini
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .
COPY --from=vendor /build/vendor ./vendor

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p storage/framework/{sessions,views,cache} storage/app/public bootstrap/cache \
    # Buang manifest/cache bawaan host (menunjuk dev-deps), regenerate untuk vendor prod
    && rm -f bootstrap/cache/*.php \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

USER www-data

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8000/up | grep -qi "up" || exit 1

ENTRYPOINT ["entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

# ------------------------------------------------------------
# Target PROD — FrankenPHP + Laravel Octane (bukan artisan serve)
# ------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.4-alpine AS prod
WORKDIR /var/www/html

RUN apk add --no-cache --virtual .build-deps \
        postgresql-dev $PHPIZE_DEPS linux-headers \
    && apk add --no-cache postgresql-libs postgresql-client libzip-dev libpng-dev oniguruma-dev icu-dev \
    && docker-php-ext-install pdo pdo_pgsql mbstring zip gd intl pcntl bcmath opcache \
    && pecl install redis \
    && docker-php-ext-enable redis opcache \
    && apk del .build-deps \
    && rm -rf /tmp/* /var/cache/apk/*

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-lms.ini

# Base ini tidak punya binary `php` (CLI = `frankenphp php-cli`) — shim agar
# `php artisan` (entrypoint, queue, scheduler) tetap jalan apa adanya.
# Catatan: shim tidak mendukung flag `-d`; composer tidak disertakan di runtime.
RUN printf '#!/bin/sh\nexec /usr/local/bin/frankenphp php-cli "$@"\n' > /usr/local/bin/php \
    && chmod +x /usr/local/bin/php

COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY . .
COPY --from=vendor /build/vendor ./vendor

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p storage/framework/{sessions,views,cache} storage/app/public bootstrap/cache \
    && rm -f bootstrap/cache/*.php \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    # Caddy/frankenphp butuh /config & /data yang writable oleh user non-root.
    && chown -R www-data:www-data /config /data \
    && chmod -R 775 storage bootstrap/cache

USER www-data

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8000/up | grep -qi "up" || exit 1

ENTRYPOINT ["entrypoint.sh"]
# max-requests membatasi bocor memori worker; tanpa --watch (tidak reload file).
CMD ["php", "artisan", "octane:start", "--server=frankenphp", "--host=0.0.0.0", "--port=8000", "--max-requests=500"]
