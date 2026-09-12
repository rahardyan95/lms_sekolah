import { defineConfig, devices } from '@playwright/test';

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
  projects: [
    {
      name: 'desktop',
      testIgnore: ['mobile.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Matriks mobile: satu 375 (iPhone SE metrics) dan satu Pixel 5 (393) —
    // dua titik yang dipakai audit responsif. Keduanya memakai Chromium:
    // hanya browser itu yang terpasang di image CI/dev (WebKit tidak ada).
    {
      name: 'mobile-375',
      testMatch: /mobile\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'mobile-390',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
