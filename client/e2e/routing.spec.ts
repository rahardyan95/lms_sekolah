import { expect, test, type Page } from '@playwright/test';

const PASS = process.env.E2E_DEMO_PASSWORD || 'password123';

async function loginStaff(page: Page, identifier: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-staff').click();
  await page.getByTestId('input-staff-email').fill(identifier);
  await page.getByTestId('input-staff-password').fill(PASS);
  await page.getByTestId('btn-staff-submit').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 15000 });
}

async function loginStudent(page: Page, nisn: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /masuk portal/i }).first().click();
  await page.getByTestId('tab-login-siswa').click();
  await page.getByTestId('input-student-nisn').fill(nisn);
  await page.getByTestId('input-student-password').fill(PASS);
  await page.getByTestId('btn-student-submit').click();
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 15000 });
}

test('login staf → URL modul tersinkron dan tahan refresh', async ({ page }) => {
  await loginStaff(page, 'superadmin@sekolah.sch.id');

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  // Dashboard memuat angka dari server (bukan mock): kartu KPI tampil.
  await expect(page.getByTestId('admin-dashboard-overview')).toBeVisible();
  await expect(page.getByText('Siswa Aktif')).toBeVisible();

  // Refresh di tengah kerja: sesi dipulihkan dari server, modul tetap sama.
  await page.reload();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByTestId('auth-module')).toBeHidden({ timeout: 15000 });
});

test('ganti modul via sidebar mengubah URL (deep-link)', async ({ page }) => {
  await loginStaff(page, 'operator@sekolah.sch.id');
  await expect(page).toHaveURL(/\/app\/attendance$/);

  await page.getByRole('button', { name: /perpustakaan/i }).first().click();
  await expect(page).toHaveURL(/\/app\/library$/);
});

test('deep-link di luar wewenang peran portal → dialihkan ke modul sendiri', async ({ page }) => {
  await loginStudent(page, '0071829384');
  await expect(page).toHaveURL(/\/app\/student$/);

  // Siswa memaksa URL modul keuangan — guard harus mengembalikannya.
  await page.goto('/app/finance');
  await expect(page).toHaveURL(/\/app\/student$/);
});
