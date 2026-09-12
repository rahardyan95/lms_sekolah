import { expect, test, type Page } from '@playwright/test';

/**
 * Paritas & responsivitas mobile (dijalankan di project mobile-375 dan mobile-390):
 * memastikan layar mobile tidak overflow horizontal, kontrol utama cukup besar
 * untuk disentuh (>=44px), navigasi modul staf terjangkau lewat drawer, dan
 * alur tulis utama tetap berfungsi di viewport kecil.
 */

const PASS = process.env.E2E_DEMO_PASSWORD || 'password123';

/**
 * Bawa halaman ke modul auth. Bila sesi masih aktif (mis. setelah logout UI),
 * modul auth sudah tampil dan langkah landing dilewati; di mobile CTA landing
 * hanya muncul setelah menu dibuka.
 */
async function keModulAuth(page: Page) {
  if (await page.getByTestId('input-staff-email').isVisible().catch(() => false)) return;

  const headerCta = page.getByTestId('landing-login-button');
  if (await headerCta.isVisible().catch(() => false)) {
    await headerCta.click();
    return;
  }

  await page.getByRole('button', { name: /buka menu navigasi/i }).click();
  await page.locator('#landing-mobile-menu').getByRole('button', { name: /masuk portal/i }).click();
}

async function masukPortal(page: Page) {
  await page.goto('/');
  await keModulAuth(page);
}

async function loginStaff(page: Page, identifier: string) {
  await masukPortal(page);
  await page.getByTestId('tab-login-staff').click();
  await page.getByTestId('input-staff-email').fill(identifier);
  await page.getByTestId('input-staff-password').fill(PASS);
  await page.getByTestId('btn-staff-submit').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 20000 });
}

async function loginSiswa(page: Page, nisn: string) {
  await masukPortal(page);
  await page.getByTestId('tab-login-siswa').click();
  await page.getByTestId('input-student-nisn').fill(nisn);
  await page.getByTestId('input-student-password').fill(PASS);
  await page.getByTestId('btn-student-submit').click();
  await expect(page).toHaveURL(/\/app\/student$/, { timeout: 20000 });
}

async function loginOrtu(page: Page, nisn: string) {
  await masukPortal(page);
  await page.getByTestId('tab-login-ortu').click();
  await page.getByTestId('input-parent-nisn').fill(nisn);
  await page.getByTestId('input-parent-dob').fill('2008-04-15');
  await page.getByTestId('btn-parent-submit').click();
  await expect(page).toHaveURL(/\/app\/parent$/, { timeout: 20000 });
}

/** Tidak boleh ada konten yang melebarkan halaman (overflow horizontal). */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label}: dokumen melebar ${overflow.scrollWidth}px > viewport ${overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/** Kontrol utama harus >=44px (target sentuh project) dan tidak tertutup. */
async function expectTapTargets(page: Page, testIds: string[], label: string) {
  for (const testId of testIds) {
    const el = page.getByTestId(testId).first();
    if ((await el.count()) === 0) continue;
    const box = await el.boundingBox();
    if (!box) continue;
    expect(box.height, `${label}: ${testId} tinggi ${box.height}px (<44)`).toBeGreaterThanOrEqual(44);
  }
}

test('landing publik mobile: tanpa overflow + CTA dapat disentuh', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('public-landing-page')).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, 'landing mobile');
});

test('navigasi modul staf mobile lewat drawer (sidebar desktop tersembunyi)', async ({ page }) => {
  await loginStaff(page, 'operator@sekolah.sch.id');

  // Hamburger hanya tampil < lg; drawer memuat seluruh modul.
  await expect(page.getByTestId('btn-open-nav')).toBeVisible();
  await page.getByTestId('btn-open-nav').click();
  await expect(page.getByTestId('nav-drawer-menu-panel')).toBeVisible();
  await expect(page.getByTestId('nav-drawer-menu-kts')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'drawer navigasi');

  await page.getByTestId('nav-drawer-menu-kts').click();
  await expect(page).toHaveURL(/\/app\/kts$/, { timeout: 20000 });
  await expect(page.getByTestId('mobile-nav-drawer')).toBeHidden();
  await expectNoHorizontalOverflow(page, 'modul KTS mobile');
});

test('portal siswa mobile: 5 tab bottom-nav, tulis presensi manual, unggah foto KTS', async ({ page, browser }) => {
  test.setTimeout(180_000);

  // --- Portal siswa: semua tab terjangkau & tidak overflow
  await loginSiswa(page, '0071829384');
  await expect(page.getByTestId('student-portal-module')).toBeVisible();

  for (const label of ['Jadwal', 'Tugas', 'Nilai', 'Profil', 'Beranda']) {
    await page.getByTestId('student-bottom-nav').getByRole('button', { name: label }).click();
    await expectNoHorizontalOverflow(page, `portal siswa — tab ${label}`);
  }

  await expectTapTargets(page, ['btn-notification-bell', 'btn-open-cbt-room'], 'portal siswa');

  // --- Operator (konteks browser BARU): sesi siswa tidak diwarisi, dan tidak
  // bergantung pada alur logout/landing yang bisa mengembalikan sesi lama.
  const viewport = page.viewportSize() ?? { width: 375, height: 667 };
  const operatorContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    viewport,
    isMobile: true,
    hasTouch: true,
  });
  const operator = await operatorContext.newPage();

  try {
    await loginStaff(operator, 'operator@sekolah.sch.id');
    await operator.getByTestId('tab-attendance-manual').click();

    const select = operator.getByTestId('input-manual-nisn');
    await expect(select).toBeVisible({ timeout: 30000 });
    await operator.waitForFunction(() => {
      const el = document.querySelector('[data-testid="input-manual-nisn"]');
      return !!el && [...el.querySelectorAll('option')].some((o) => (o as HTMLOptionElement).value !== '');
    }, { timeout: 20000 });

    const nisn = await select.evaluate((el) => {
      const option = [...el.querySelectorAll('option')].find((o) => (o as HTMLOptionElement).value !== '');
      return (option as HTMLOptionElement).value;
    });

    const seed = Math.floor(Date.now() / 60_000);
    const month = String((seed % 12) + 1).padStart(2, '0');
    const day = String((Math.floor(seed / 12) % 27) + 1).padStart(2, '0');

    await select.selectOption(nisn);
    await operator.getByTestId('input-manual-date').fill(`2036-${month}-${day}`);
    await operator.getByTestId('input-manual-status').selectOption('izin');
    await operator.getByTestId('input-manual-reason').fill('Uji mobile entri manual.');
    await operator.getByTestId('btn-submit-manual').click();
    await expect(operator.getByText('Presensi Disimpan').first()).toBeVisible({ timeout: 20000 });
    await expectNoHorizontalOverflow(operator, 'rekap presensi mobile');

    // --- KTS: unggah foto kartu dari perangkat
    await operator.getByTestId('btn-open-nav').click();
    await operator.getByTestId('nav-drawer-menu-kts').click();
    await expect(operator.getByTestId('kts-module')).toBeVisible({ timeout: 30000 });

    await expect(operator.getByTestId('select-kts-student')).toHaveValue(/.+/, { timeout: 20000 });

    // Input foto baru aktif setelah id siswa server ter-resolve (roster + lookup id).
    const photoInput = operator.getByTestId('input-kts-photo');
    await expect(photoInput).toBeEnabled({ timeout: 20000 });

    await photoInput.setInputFiles({
      name: 'foto-uji.png',
      mimeType: 'image/png',
      // PNG 1x1 transparan — cukup untuk memverifikasi jalur unggah.
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    await expect(operator.getByTestId('kts-photo-preview')).toBeVisible({ timeout: 20000 });
    await expectNoHorizontalOverflow(operator, 'modul KTS mobile');
  } finally {
    await operatorContext.close();
  }
});

test('portal orang tua mobile: 5 tab tanpa overflow', async ({ page }) => {
  await loginOrtu(page, '0071829384');
  await expect(page.getByTestId('parent-portal-module')).toBeVisible();

  for (const tab of ['presensi', 'nilai', 'spp', 'jadwal', 'kts']) {
    await page.getByTestId(`parent-tab-${tab}`).click();
    await expectNoHorizontalOverflow(page, `portal ortu — tab ${tab}`);
  }
});

test('keuangan mobile: tab strip dapat discroll, penyesuaian tagihan berfungsi', async ({ page }) => {
  await loginStaff(page, 'bendahara@sekolah.sch.id');
  await expect(page.getByTestId('finance-module')).toBeVisible({ timeout: 30000 });

  // Tab strip discroll di dalam kontainer: dokumen tidak boleh melebar.
  await expectNoHorizontalOverflow(page, 'keuangan mobile');

  await page.getByTestId('tab-finance-cash').click();
  await expect(page.getByTestId('input-cash-channel')).toBeVisible();

  await page.getByTestId('tab-finance-spp').click();
  const adjustButton = page.locator('[data-testid^="btn-adjust-"]').first();
  await expect(adjustButton).toBeVisible({ timeout: 20000 });
  await adjustButton.click();

  const form = page.locator('[data-testid^="adjust-form-"]').first();
  await expect(form).toBeVisible();
  await form.getByTestId('input-adjust-amount').fill('-5000');
  await form.getByTestId('input-adjust-reason').fill('Uji mobile penyesuaian tagihan.');
  await form.getByTestId('btn-adjust-submit').click();
  await expect(page.getByText('Penyesuaian Tersimpan').first()).toBeVisible({ timeout: 20000 });
  await expectNoHorizontalOverflow(page, 'keuangan mobile setelah penyesuaian');
});
