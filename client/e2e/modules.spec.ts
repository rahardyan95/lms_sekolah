import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASS = process.env.E2E_DEMO_PASSWORD || 'password123';

async function axePass(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
  expect(blocking, `${label}: ${blocking.map((v) => v.id).join(', ')}`).toEqual([]);
}

async function loginStaff(page: Page, identifier: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-staff').click();
  await page.getByTestId('input-staff-email').fill(identifier);
  await page.getByTestId('input-staff-password').fill(PASS);
  await page.getByTestId('btn-staff-submit').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 15000 });
}

test('parent portal 4 tab: presensi live + nilai + spp + jadwal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-ortu').click();
  await page.getByTestId('input-parent-nisn').fill('0071829384');
  await page.getByTestId('input-parent-dob').fill('2008-04-15');
  await page.getByTestId('btn-parent-submit').click();
  await expect(page).toHaveURL(/\/app\/parent$/, { timeout: 15000 });

  await expect(page.getByTestId('parent-portal-module')).toBeVisible();
  await expect(page.getByTestId('parent-tab-presensi')).toBeVisible();

  await page.getByTestId('parent-tab-nilai').click();
  await expect(page.getByText(/Nilai resmi yang sudah dipublish/i)).toBeVisible();

  await page.getByTestId('parent-tab-spp').click();
  await expect(page.getByText(/Ringkasan tagihan resmi/i)).toBeVisible();

  await page.getByTestId('parent-tab-jadwal').click();
  await expect(page.getByText(/Jadwal Pelajaran KBM/i)).toBeVisible();
  await axePass(page, 'parent-portal');
});

test('finance: panel live + pos biaya server + kwitansi flow', async ({ page }) => {
  await loginStaff(page, 'bendahara@sekolah.sch.id');
  await page.getByRole('button', { name: /keuangan|spp/i }).first().click();
  await expect(page.getByTestId('finance-module')).toBeVisible();

  await page.getByTestId('tab-finance-pos').click();
  await expect(page.getByText(/Pos Pembayaran/i)).toBeVisible();
  await axePass(page, 'finance');
});

test('cbt + kts + settings: guard kunci + verify + badge server', async ({ page }) => {
  await loginStaff(page, 'operator@sekolah.sch.id');

  await page.getByRole('button', { name: /ujian online cbt/i }).first().click();
  await expect(page.getByTestId('cbt-module')).toBeVisible();

  await page.getByRole('button', { name: /kts digital/i }).first().click();
  await expect(page.getByTestId('kts-module')).toBeVisible();
  await axePass(page, 'cbt-kts');
});
