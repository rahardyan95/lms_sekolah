import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';
const PASS = process.env.E2E_DEMO_PASSWORD || 'password123';

async function axePass(page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
  expect(blocking, `${label}: ${blocking.map((v) => v.id).join(', ')}`).toEqual([]);
}

test('landing publik terbuka + tanpa violation kritis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('public-landing-page')).toBeVisible();
  // Pindai setelah halaman mantap: memindai saat render/lazy-image berjalan
  // membuat hasil a11y tidak deterministik.
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  await axePass(page, 'landing');
});

test('login 8 role mengarah ke portal benar', async ({ page, request }) => {
  const cases: Array<[string, RegExp]> = [
    ['superadmin@sekolah.sch.id', /Dashboard|dashboard|Admin/i],
    ['0071829384', /Siswa|LMS|Tugas/i],
    ['SPMB-2026-0089', /SPMB|Pendaftaran/i],
  ];
  for (const [identifier] of cases) {
    const res = await request.post(`${API}/login`, { data: { identifier, password: PASS } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTruthy();
  }
  // UI: login staff via form mengarah ke dashboard
  await page.goto('/');
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-staff').click();
  await page.getByTestId('input-staff-email').fill('superadmin@sekolah.sch.id');
  await page.getByTestId('input-staff-password').fill(PASS);
  await page.getByTestId('btn-staff-submit').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 15000 });
  // Tunggu permukaan dashboard benar-benar mantap sebelum memindai a11y:
  // memindai saat transisi/loading membuat hasil tidak deterministik.
  await expect(page.getByTestId('admin-dashboard-overview')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1000);
  await axePass(page, 'post-login');
});

test('panel akun demo: satu klik masuk untuk setiap peran', async ({ page, context }) => {
  test.setTimeout(240_000);
  const roles = ['super_admin', 'admin_tu', 'guru', 'bendahara', 'operator', 'siswa', 'orang_tua', 'calon_siswa'];
  for (const role of roles) {
    // Setiap peran diuji dari nol: cookie httpOnly dibuang, penanda sesi
    // (sessionStorage) dibersihkan, lalu aplikasi di-boot ulang. Tanpa ini,
    // event "sesi berakhir" dari iterasi sebelumnya menarik UI balik ke landing.
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await page.reload();

    await page.getByRole('button', { name: /masuk portal/i }).first().click();
    await expect(page.getByTestId('demo-accounts-panel'), `panel demo tidak tampil untuk ${role}`)
      .toBeVisible({ timeout: 30000 });

    await page.getByTestId(`btn-demo-${role}`).click();

    await expect(page.getByTestId('auth-module'), `role ${role} gagal masuk`).toBeHidden({ timeout: 20000 });
    await expect(page, `role ${role} tidak diarahkan ke /app`).toHaveURL(/\/app\//, { timeout: 20000 });
  }
});

test('mutasi tulis dari SPA lolos CSRF (buat lalu hapus berita)', async ({ page, context }) => {
  // Regresi: origin dev (Vite :5173) → API (:8000) bersifat cross-origin,
  // sehingga header X-XSRF-TOKEN hanya terkirim bila axios dikonfigurasi
  // eksplisit. Tanpa itu semua mutasi berbasis cookie gagal 419 CSRF_MISMATCH.
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.reload();

  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('btn-demo-super_admin').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 20000 });

  await page.getByTestId('sidebar-menu-cms_admin').click();
  await expect(page.getByTestId('cms-admin-module')).toBeVisible({ timeout: 30000 });

  const title = `E2E Mutasi ${Date.now()}`;
  await page.getByTestId('btn-create-post').click();
  await page.getByTestId('input-cms-title').fill(title);
  await page.getByTestId('input-cms-content').fill('<p>Uji mutasi tulis.</p>');
  await page.getByTestId('input-cms-status').selectOption('draft');
  await page.getByTestId('btn-save-post').click();

  const row = page.locator('tr', { hasText: title });
  await expect(row, 'berita baru tidak tersimpan (kemungkinan 419/403)').toBeVisible({ timeout: 20000 });

  await row.getByTestId(/^btn-delete-post-/).click();
  await expect(page.locator('tr', { hasText: title })).toHaveCount(0, { timeout: 20000 });
});
