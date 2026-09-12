import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // Dev lokal: SEMUA worker menembak SATU container PHP dev server + limiter
  // per-user (`throttle:api`), sehingga worker paralel saling mengalahkan dan
  // memunculkan flake (badge/URL belum terisi). Serial = deterministik.
  // Saat `E2E_BASE_URL` menunjuk deployment nyata (Octane), biarkan paralel.
  workers: process.env.E2E_BASE_URL ? undefined : 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', port: 5173, reuseExistingServer: true },
});
