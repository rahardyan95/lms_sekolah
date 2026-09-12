import type { UserRole } from '../types';

export interface DemoCredential {
  role: UserRole;
  label: string;
  identifier: string;
  password: string;
  /** Tanggal lahir anak untuk portal orang tua (NISN + DOB). */
  birthDate?: string;
  tab: 'staff' | 'siswa' | 'orang_tua' | 'spmb';
  /** Portal tujuan setelah login — dipakai untuk label tombol. */
  portal: string;
}

/**
 * OOP katalog kredensial demo (satu per role) untuk tombol "isi otomatis"
 * di halaman login. Hanya dirender saat Vite DEV — produksi tidak pernah
 * memuat berkas ini ke bundle (import di-guard `import.meta.env.DEV`).
 *
 * Password default mengikuti SEED_DEMO_PASSWORD milik server; dapat
 * ditimpa lewat VITE_DEMO_PASSWORD agar tidak perlu ubah kode.
 */
export class DemoAccounts {
  static readonly PASSWORD: string =
    (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? 'password123';

  private static readonly ALL: DemoCredential[] = [
    { role: 'super_admin', label: 'Super Admin', identifier: 'superadmin@sekolah.sch.id', tab: 'staff', portal: 'Dashboard', password: DemoAccounts.PASSWORD },
    { role: 'admin_tu', label: 'Admin / TU', identifier: 'admin@sekolah.sch.id', tab: 'staff', portal: 'Dashboard', password: DemoAccounts.PASSWORD },
    { role: 'guru', label: 'Guru', identifier: 'guru@sekolah.sch.id', tab: 'staff', portal: 'Akademik', password: DemoAccounts.PASSWORD },
    { role: 'bendahara', label: 'Bendahara', identifier: 'bendahara@sekolah.sch.id', tab: 'staff', portal: 'Keuangan', password: DemoAccounts.PASSWORD },
    { role: 'operator', label: 'Operator', identifier: 'operator@sekolah.sch.id', tab: 'staff', portal: 'Presensi', password: DemoAccounts.PASSWORD },
    { role: 'siswa', label: 'Siswa', identifier: '0071829384', tab: 'siswa', portal: 'Portal Siswa', password: DemoAccounts.PASSWORD },
    { role: 'orang_tua', label: 'Orang Tua', identifier: '0071829384', birthDate: '2008-04-15', tab: 'orang_tua', portal: 'Portal Ortu', password: DemoAccounts.PASSWORD },
    { role: 'calon_siswa', label: 'Calon Siswa', identifier: 'SPMB-2026-0089', tab: 'spmb', portal: 'SPMB', password: DemoAccounts.PASSWORD },
  ];

  static all(): DemoCredential[] {
    return [...DemoAccounts.ALL];
  }

  static forTab(tab: DemoCredential['tab']): DemoCredential[] {
    return DemoAccounts.ALL.filter((c) => c.tab === tab);
  }
}
