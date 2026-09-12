import { lazy } from 'react';

/**
 * OOP registry lazy modules — satu-satunya tempat impor dinamis view.
 * Keuntungan: chunk terpisah per modul (vite code-splitting),
 * TTI lebih cepat; tambah modul baru cukup tambah satu getter.
 */
export class ModuleLoader {
  static Auth = lazy(() =>
    import('../modules/auth/AuthModule').then((m) => ({ default: m.AuthModule })),
  );

  static ResetPassword = lazy(() =>
    import('../modules/auth/ResetPasswordModule').then((m) => ({ default: m.ResetPasswordModule })),
  );

  static Dashboard = lazy(() =>
    import('../modules/dashboard/AdminDashboardOverview').then((m) => ({ default: m.AdminDashboardOverview })),
  );

  static Kts = lazy(() =>
    import('../modules/kts/KtsModule').then((m) => ({ default: m.KtsModule })),
  );

  static Attendance = lazy(() =>
    import('../modules/attendance/AttendanceModule').then((m) => ({ default: m.AttendanceModule })),
  );

  static WhatsApp = lazy(() =>
    import('../modules/whatsapp/WhatsAppModule').then((m) => ({ default: m.WhatsAppModule })),
  );

  static Parent = lazy(() =>
    import('../modules/parent/ParentPortalModule').then((m) => ({ default: m.ParentPortalModule })),
  );

  static Student = lazy(() =>
    import('../modules/student/StudentPortalModule').then((m) => ({ default: m.StudentPortalModule })),
  );

  static Cbt = lazy(() =>
    import('../modules/cbt/CbtExamModule').then((m) => ({ default: m.CbtExamModule })),
  );

  static Library = lazy(() =>
    import('../modules/library/LibraryModule').then((m) => ({ default: m.LibraryModule })),
  );

  static Finance = lazy(() =>
    import('../modules/finance/FinanceModule').then((m) => ({ default: m.FinanceModule })),
  );

  static Spmb = lazy(() =>
    import('../modules/spmb/SpmbModule').then((m) => ({ default: m.SpmbModule })),
  );

  static Academic = lazy(() =>
    import('../modules/academic/AcademicModule').then((m) => ({ default: m.AcademicModule })),
  );

  static Cms = lazy(() =>
    import('../modules/cms/CmsPublicModule').then((m) => ({ default: m.CmsPublicModule })),
  );

  static CmsAdmin = lazy(() =>
    import('../modules/cms/CmsAdminModule').then((m) => ({ default: m.CmsAdminModule })),
  );

  static Settings = lazy(() =>
    import('../modules/settings/SettingsModule').then((m) => ({ default: m.SettingsModule })),
  );
}
