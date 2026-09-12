import { expect, test } from '@playwright/test';

/**
 * Smoke test bundle PRODUKSI (dist) — jalur yang tidak tercakup E2E dev,
 * karena hanya di sana data mock dibuang dan perilaku server-first diuji.
 *
 * Jalankan: E2E_BASE_URL=https://frontend.sekolah.sch.id npx playwright test prod-smoke
 * Lokal:    E2E_BASE_URL=http://localhost:3000 npx playwright test prod-smoke
 */
test.skip(!process.env.E2E_BASE_URL, 'butuh E2E_BASE_URL (bundle produksi)');

const PASS = process.env.E2E_DEMO_PASSWORD || 'password123';

test.beforeEach(async ({ context }) => {
  // CSP produksi (`connect-src 'self' https:`) memang memblokir API HTTP.
  // Di deployment nyata API sudah HTTPS; bypass ini hanya untuk verifikasi
  // lokal agar bundle produksi dapat diuji terhadap API dev.
  if ((process.env.E2E_BASE_URL ?? '').startsWith('http://')) {
    await context.route('**/*', async (route) => {
      const response = await route.fetch();
      const headers = { ...response.headers() };
      delete headers['content-security-policy'];
      await route.fulfill({ response, headers });
    });
  }
});

test('bundle produksi: landing bersih tanpa artefak demo + login + modul tampil', async ({ page }) => {
  await page.goto('/');

  // Artefak DEV (panel akun demo / top dev bar) tidak boleh ada di bundle produksi.
  await expect(page.getByTestId('public-landing-page')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/akun demo/i)).toHaveCount(0);
  await expect(page.getByTestId('top-dev-bar')).toHaveCount(0);

  // Login staf nyata → modul dapat dibuka (server-first, bukan mock).
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-staff').click();
  await page.getByTestId('input-staff-email').fill('operator@sekolah.sch.id');
  await page.getByTestId('input-staff-password').fill(PASS);
  await page.getByTestId('btn-staff-submit').click();

  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 30000 });

  // Navigasi modul: sidebar di desktop, drawer di viewport kecil.
  const sidebarItem = page.getByTestId('sidebar-menu-attendance');
  if (await sidebarItem.isVisible().catch(() => false)) {
    await sidebarItem.click();
  } else {
    await page.getByTestId('btn-open-nav').click();
    await page.getByTestId('nav-drawer-menu-attendance').click();
  }

  await expect(page.getByTestId('attendance-live-badge')).toBeVisible({ timeout: 30000 });

  // Nol overflow horizontal pada viewport mobile (config mobile-375/390).
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
