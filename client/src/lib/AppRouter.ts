import type { UserRole } from '../types';
import type { ActiveModuleView } from '../components/layout/Sidebar';

/**
 * Routing SPA bertipe: peta modul ↔ URL + guard per peran.
 * Dipakai untuk deep-link, refresh-safe view, dan mencegah peran
 * portal (siswa/orang tua/calon) membuka modul staf via URL.
 * Server tetap otoritas akhir (middleware role + policy per endpoint).
 */

export const MODULE_PATHS: Record<ActiveModuleView, string> = {
  dashboard: '/app/dashboard',
  kts: '/app/kts',
  attendance: '/app/attendance',
  whatsapp: '/app/whatsapp',
  parent: '/app/parent',
  student: '/app/student',
  cbt: '/app/cbt',
  library: '/app/library',
  finance: '/app/finance',
  spmb: '/app/spmb',
  academic: '/app/academic',
  cms: '/app/cms',
  cms_admin: '/app/cms-admin',
  settings: '/app/settings',
};

/** Halaman awal per peran — selaras dengan routeForRole() di App. */
export const ROLE_HOME: Record<UserRole, ActiveModuleView> = {
  super_admin: 'dashboard',
  admin_tu: 'dashboard',
  guru: 'academic',
  bendahara: 'finance',
  operator: 'attendance',
  siswa: 'student',
  orang_tua: 'parent',
  calon_siswa: 'spmb',
  public: 'cms',
};

/** Modul yang boleh dibuka tiap peran (staf bebas modul staf; portal terbatas). */
const PORTAL_ONLY: Partial<Record<UserRole, ActiveModuleView>> = {
  siswa: 'student',
  orang_tua: 'parent',
  calon_siswa: 'spmb',
};

/** Peran staf (bukan portal siswa/orang tua/calon/masyarakat umum). */
const STAFF_ROLES: UserRole[] = ['super_admin', 'admin_tu', 'guru', 'bendahara', 'operator'];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function pathForModule(view: ActiveModuleView): string {
  return MODULE_PATHS[view];
}

export function moduleFromPath(pathname: string): ActiveModuleView | null {
  const match = (Object.entries(MODULE_PATHS) as [ActiveModuleView, string][]).find(
    ([, path]) => path === pathname
  );

  return match?.[0] ?? null;
}

export function canAccess(role: UserRole, view: ActiveModuleView): boolean {
  const restricted = PORTAL_ONLY[role];

  return restricted ? restricted === view : true;
}

/** Modul awal yang aman: hormati URL bila boleh, jika tidak → halaman peran. */
export function resolveInitialView(role: UserRole, pathname: string): ActiveModuleView {
  const fromUrl = moduleFromPath(pathname);

  return fromUrl && canAccess(role, fromUrl) ? fromUrl : ROLE_HOME[role] ?? 'dashboard';
}
