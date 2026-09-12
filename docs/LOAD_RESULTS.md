# Hasil Uji Beban k6 (stack dev lokal, Docker Desktop macOS)

Alat: `client/k6/` — `smoke.js`, `probe10.js`, `load.js`.
Jalankan: `npm run test:load:smoke|probe|load` (env `K6_BASE_URL`, `K6_DEMO_PASSWORD`).

## Run 10-11 Sep 2026 — setelah migrasi runtime ke Octane + FrankenPHP

Runtime produksi diganti dari `artisan serve` (dev server) ke **Laravel Octane +
FrankenPHP** (`docker-compose.prod.yml`, image target `prod`). Diukur ulang dengan
k6 yang sama, container prod dijalankan lokal di network compose:

| Skenario | Baseline (artisan serve) | Octane + FrankenPHP |
|---|---|---|
| probe10 (10VU/70s, ~15rps) | P95(200) 194,41 ms | **P95(200) 21,76 ms** (avg 12,39 ms) |
| load (200VU/3mnt) | P95 2,92 s, ~50 rps | **P95(200) 30,96 ms ✅**, **282,8 rps** |

- `load.js` 200VU Octane: 51.007 checks **100% sukses**, threshold `p(95)<500` **PASS**.
- `http_req_failed` 81,25% tetap = **429 throttle by design** (`throttle:api` 300/mnt
  per user/IP; 200 VU dari satu IP). Bukan error server.
- Kesimpulan: bottleneck P95 2,9 s sebelumnya adalah `artisan serve` (single-threaded),
  bukan aplikasi. Target PRD NFR-002 (P95 ≤500 ms) kini terpenuhi dengan margin besar.

## Run 10 Sep 2026 (baseline sebelum runtime prod diganti)

| Skenario | Hasil |
|---|---|
| smoke (1VU, 12 endpoint) | 13/13 checks hijau |
| probe10 (10VU/70s, ~20rps) | P95(200) **49,63 ms** (budget ≤500ms ✅), checks 100% |
| load (hingga 200VU/3mnt, ~50rps satu IP) | P95(200) **2,92 s** ❌, 73,9% respons = **429 throttle** (by design) |

## Analisis jujur (baseline artisan serve — sudah tidak berlaku untuk prod)

1. **429 massal pada load.js adalah proteksi, bukan bug**: `throttle:api` 300/mnt
   per user/IP. 200VU dari SATU IP = pola banjir; trafik riil tersebar banyak IP.
2. **P95 2,9s pada 200VU** adalah batas `artisan serve` (dev server, single-thread)
   — sudah diselesaikan dengan Octane+FrankenPHP (tabel di atas).

## Run 11 Sep 2026 — Fase 5 (smoke fix + probe + Lighthouse perdana)

- `k6/smoke.js`: diperbaiki — `/up` dihitung dari `K6_BASE_URL` (root host, bukan
  prefix `/api/v1`) via `K6_UP_URL`. Hasil: **13/13 checks hijau** (artefak
  `client/k6/results/smoke-20260911.json`).
- `k6/probe10.js` (dev `artisan serve`, 10VU/70s): `checks 100%` (1014/1014),
  `http_req_duration{status:200}` **P95 68,3 ms** ✅ (budget NFR-002 ≤500 ms);
  `http_req_failed` 42,46% = **429 throttle by design** (satu IP).
- Lighthouse desktop perdana (vite dev `:5173`, host run):
  performance **56** ❌ (target ≥85), accessibility **96** ✅, best-practices **100** ✅,
  SEO **92** ✅; FCP 3,9 s / TTI 7,3 s / LCP 7,3 s / CLS 0.
  Penyebab perf: dev-server unminified (`unminified-javascript` hemat 5,8 MB,
  `unused-javascript` 1,2 MB) — bukan bundle prod. Artefak:
  `client/lighthouse/landing-20260911.json`.
- Lighthouse **build prod** (`npm run build` + `vite preview :4173`, host run):
  performance **100** ✅, accessibility **96** ✅, best-practices **96** ✅,
  SEO **92** ✅; FCP 0,5 s / TTI 0,7 s / LCP 0,7 s / CLS 0 — NFR-001
  (FCP <2 s, TTI <3 s) **terpenuhi dengan margin besar**. Artefak:
  `client/lighthouse/landing-preview-prod-20260911.json`.

## Tindak lanjut (VPS)

1. Ulangi `load.js` di VPS dengan load terdistribusi (sudah terpasang Octane; fokus
   pada kapasitas VPS + tuning `OCTANE_WORKERS`).
2. Pertimbangkan menaikkan `throttle:api` berbasis peran (siswa baca > staf tulis)
   bila 429 sah muncul di trafik normal.
3. Raw JSON run 200VU tersimpan: `client/k6/results/load.json` (+ `load-workers16.json`).
