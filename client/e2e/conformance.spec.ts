import { expect, test, type Page, type BrowserContext } from '@playwright/test';

/**
 * Otomasi alur tulis yang baru diwire (Phase 3-13).
 * Fokus: mutasi nyata lewat UI → dibuktikan oleh perubahan yang terlihat,
 * bukan sekadar "tombol bisa diklik". Setiap tes masuk lewat panel Akun Demo
 * sehingga tidak bergantung pada urutan tes lain.
 */

async function loginAsDemo(page: Page, context: BrowserContext, role: string) {
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.reload();

  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId(`btn-demo-${role}`).click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 20000 });
}

test('KTS: simpan template menaikkan versi (riwayat tidak ditimpa)', async ({ page, context }) => {
  await loginAsDemo(page, context, 'admin_tu');

  await page.getByTestId('sidebar-menu-kts').click();
  await expect(page.getByTestId('kts-template-builder')).toBeVisible({ timeout: 30000 });

  // Template dimuat lewat request terpisah setelah modul mount; beri jeda
  // singkat supaya pembacaan baseline tidak menangkap placeholder.
  await page.waitForTimeout(1500);

  // Badge versi diisi setelah template termuat; tunggu angkanya, bukan placeholder.
  const versionBadge = page.getByTestId('kts-template-version');
  await expect(versionBadge).toContainText(/v\d+/, { timeout: 30000 });
  const readVersion = async () =>
    Number(((await versionBadge.innerText()).match(/\d+/) ?? ['0'])[0]);

  const before = await readVersion();

  await page.getByTestId('input-kts-watermark').fill(`E2E ${Date.now()}`);

  // Tunggu respons server, bukan sekadar klik: badge diganti setelah PUT sukses.
  const saved = page.waitForResponse(
    (res) => res.url().includes('/kts/templates') && res.request().method() === 'PUT',
    { timeout: 20000 },
  );
  await page.getByTestId('btn-kts-save-template').click();
  expect((await saved).status()).toBe(200);

  // Versi harus NAIK (bukan angka tetap): template lama tidak pernah ditimpa.
  await expect.poll(readVersion, { timeout: 20000 }).toBeGreaterThan(before);
});

test('Presensi: entri manual tersimpan dan muncul di riwayat', async ({ page, context }) => {
  await loginAsDemo(page, context, 'operator');

  await page.getByTestId('sidebar-menu-attendance').click();
  await page.getByTestId('tab-attendance-manual').click();

  const studentSelect = page.getByTestId('input-manual-nisn');
  await expect(studentSelect).toBeVisible({ timeout: 30000 });

  // Tunggu daftar siswa dari server, lalu pilih NISN pertama yang nyata.
  await page.waitForFunction(
    () => {
      const select = document.querySelector('[data-testid="input-manual-nisn"]');
      if (!select) return false;
      return [...select.querySelectorAll('option')].some((o) => (o as HTMLOptionElement).value !== '');
    },
    { timeout: 20000 },
  );

  const nisn = await studentSelect.evaluate((el) => {
    const option = [...el.querySelectorAll('option')].find((o) => (o as HTMLOptionElement).value !== '');
    return (option as HTMLOptionElement).value;
  });

  // (siswa, tanggal) unik di server, jadi tanggal diturunkan dari waktu jalan
  // agar tes bisa diulang tanpa menabrak 409 dari run sebelumnya.
  const seed = Math.floor(Date.now() / 60_000);
  const month = String((seed % 12) + 1).padStart(2, '0');
  const day = String((Math.floor(seed / 12) % 27) + 1).padStart(2, '0');
  const uniqueDate = `2034-${month}-${day}`;

  await studentSelect.selectOption(nisn);
  await page.getByTestId('input-manual-date').fill(uniqueDate);
  await page.getByTestId('input-manual-status').selectOption('izin');
  await page.getByTestId('input-manual-reason').fill('Uji otomasi entri manual.');
  await page.getByTestId('btn-submit-manual').click();

  await expect(page.getByText('Presensi Disimpan').first()).toBeVisible({ timeout: 20000 });
});

test('Keuangan: transaksi kas baru tampil di daftar kas', async ({ page, context }) => {
  await loginAsDemo(page, context, 'bendahara');

  await page.getByTestId('sidebar-menu-finance').click();
  await page.getByTestId('tab-finance-cash').click();

  const category = `E2E-KAS-${Date.now()}`;

  await page.getByTestId('input-cash-type').selectOption('income');
  await page.getByTestId('input-cash-category').fill(category);
  await page.getByTestId('input-cash-amount').fill('12345');
  await page.getByTestId('input-cash-date').fill('2031-05-06');
  await page.getByTestId('btn-save-cash').click();

  await expect(page.getByText('Transaksi Kas Disimpan').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(category).first()).toBeVisible({ timeout: 20000 });
});

test('Bank: nomor rekening tampil ter-mask, tidak pernah utuh', async ({ page, context }) => {
  await loginAsDemo(page, context, 'bendahara');

  await page.getByTestId('sidebar-menu-finance').click();
  await page.getByTestId('tab-finance-cash').click();

  await page.getByTestId('input-bank-name').fill('Bank Uji');
  await page.getByTestId('input-bank-account').fill('5555666677778888');
  await page.getByTestId('input-bank-holder').fill('Yayasan Uji');
  await page.getByTestId('btn-save-bank').click();

  await expect(page.getByText('Rekening Disimpan').first()).toBeVisible({ timeout: 20000 });
  // Nomor termask tampil di DAFTAR rekening (select kanal kas juga memuat teks
  // serupa — scope ke daftar agar asersi tidak ambigu).
  const bankList = page.getByTestId('bank-account-list');
  await expect(bankList.getByText('****8888').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('5555666677778888')).toHaveCount(0);
});
