import { describe, expect, it } from 'vitest';
import {
  ROLE_HOME,
  canAccess,
  isStaffRole,
  moduleFromPath,
  pathForModule,
  resolveInitialView,
} from './AppRouter';

describe('AppRouter', () => {
  it('memetakan modul ke path dan sebaliknya (round-trip)', () => {
    expect(pathForModule('finance')).toBe('/app/finance');
    expect(moduleFromPath('/app/finance')).toBe('finance');
  });

  it('mengembalikan null untuk path yang tidak dikenal', () => {
    expect(moduleFromPath('/halaman-lain')).toBeNull();
  });

  it('peran portal hanya boleh modulnya sendiri', () => {
    expect(canAccess('siswa', 'student')).toBe(true);
    expect(canAccess('siswa', 'finance')).toBe(false);
    expect(canAccess('orang_tua', 'parent')).toBe(true);
    expect(canAccess('orang_tua', 'settings')).toBe(false);
    expect(canAccess('calon_siswa', 'spmb')).toBe(true);
    expect(canAccess('calon_siswa', 'cbt')).toBe(false);
  });

  it('peran staf boleh membuka modul staf', () => {
    expect(canAccess('super_admin', 'settings')).toBe(true);
    expect(canAccess('operator', 'attendance')).toBe(true);
    expect(canAccess('guru', 'academic')).toBe(true);
  });

  it('resolveInitialView menghormati deep-link yang diizinkan', () => {
    expect(resolveInitialView('guru', '/app/library')).toBe('library');
  });

  it('resolveInitialView menolak deep-link terlarang → halaman peran', () => {
    expect(resolveInitialView('siswa', '/app/finance')).toBe('student');
    expect(resolveInitialView('super_admin', '/tidak-ada')).toBe('dashboard');
  });

  it('setiap peran punya halaman awal', () => {
    expect(ROLE_HOME.siswa).toBe('student');
    expect(ROLE_HOME.orang_tua).toBe('parent');
    expect(ROLE_HOME.calon_siswa).toBe('spmb');
  });

  it('isStaffRole hanya true untuk peran staf', () => {
    expect(isStaffRole('operator')).toBe(true);
    expect(isStaffRole('bendahara')).toBe(true);
    expect(isStaffRole('siswa')).toBe(false);
    expect(isStaffRole('orang_tua')).toBe(false);
    expect(isStaffRole('public')).toBe(false);
  });
});
