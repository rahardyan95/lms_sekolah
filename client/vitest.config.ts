import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom: logic murni + component Container/Presentational (loading/empty/error).
    // E2E browser tetap via Playwright (e2e/).
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
});
