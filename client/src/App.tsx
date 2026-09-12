import React, { useEffect, useState, Suspense } from 'react';
import { X } from 'lucide-react';
import { UserRole, Student, SpmbCandidate, SchoolConfig } from './types';
import {
  initialSchoolConfig,
  mockStudents,
  mockTeachers,
  mockSubjects,
  mockAttendanceRecords,
  mockSchedule,
  mockAssignments,
  mockMaterials,
  mockCbtExams,
  mockGrades,
  mockSppProfile,
  mockCashTransactions,
  mockSpmbWaves,
  mockSpmbCandidates,
  mockLibraryBooks,
  mockNewsPosts,
  mockAnnouncements,
} from './data/mockData';

// Data demo hanya di DEV. Cabang ini di-fold saat build, sehingga berkas mock
// tidak ikut ke bundle produksi: tidak ada baris data karangan yang terkirim.
const MOCKS = import.meta.env.DEV
  ? {
      students: mockStudents,
      attendanceRecords: mockAttendanceRecords,
      assignments: mockAssignments,
      grades: mockGrades,
      candidates: mockSpmbCandidates,
      announcements: mockAnnouncements,
      schedule: mockSchedule,
      materials: mockMaterials,
      cbtExams: mockCbtExams,
      libraryBooks: mockLibraryBooks,
      cashTransactions: mockCashTransactions,
      spmbWaves: mockSpmbWaves,
      subjects: mockSubjects,
      newsPosts: mockNewsPosts,
      sppProfile: mockSppProfile,
    }
  : null;

// Common Components
import { TopDevBar } from './components/common/TopDevBar';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveModuleView } from './components/layout/Sidebar';
import { MobileShellWrapper } from './components/layout/MobileShellWrapper';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { ModuleErrorBoundary } from './components/common/ModuleErrorBoundary';
import { ModuleLoader } from './components/lazy/ModuleLoader';
import { SecurityAuditModal } from './components/security/SecurityAuditModal';
import { AuthService, type SessionProfile } from './services/AuthService';
import { SessionManager } from './services/SessionManager';
import { initialsAvatar } from './utils/helpers';
import { ROLE_HOME, canAccess, isStaffRole, moduleFromPath, pathForModule, resolveInitialView } from './lib/AppRouter';
import { DashboardApiService, type DashboardSummary } from './services/DashboardApiService';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Module Components — lazy via ModuleLoader (code-splitting per modul).
const AuthModule = ModuleLoader.Auth;
const ResetPasswordModule = ModuleLoader.ResetPassword;
const AdminDashboardOverview = ModuleLoader.Dashboard;
const KtsModule = ModuleLoader.Kts;
const AttendanceModule = ModuleLoader.Attendance;
const WhatsAppModule = ModuleLoader.WhatsApp;
const ParentPortalModule = ModuleLoader.Parent;
const StudentPortalModule = ModuleLoader.Student;
const CbtExamModule = ModuleLoader.Cbt;
const LibraryModule = ModuleLoader.Library;
const FinanceModule = ModuleLoader.Finance;
const SpmbModule = ModuleLoader.Spmb;
const AcademicModule = ModuleLoader.Academic;
const CmsPublicModule = ModuleLoader.Cms;
const CmsAdminModule = ModuleLoader.CmsAdmin;
const SettingsModule = ModuleLoader.Settings;

/** Batas idle sesi (FRD §3.1): 30 menit tanpa aktivitas → sesi diakhiri. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Cek idle tiap menit — cukup rapat, murah, tanpa timer per-event. */
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

function ModuleFallback() {
  return (
    <div
      className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs animate-pulse"
      aria-busy="true"
      aria-label="Memuat modul"
    >
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
    </div>
  );
}

export function App() {
  // Global State
  const [currentRole, setCurrentRole] = useState<UserRole>('public');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [sessionChecked, setSessionChecked] = useState<boolean>(false);
  // Identitas pengguna dari server (GET /me) — bukan metadata hardcoded UI.
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);
  // Ringkasan dashboard staf dari server (angka nyata, bukan mock).
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<ActiveModuleView>('cms');
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  // Drawer navigasi modul untuk layar < lg (sidebar desktop disembunyikan di sana).
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [auditCount, setAuditCount] = useState<number>(3);

  // Core Data Stores
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(initialSchoolConfig);
  const [students, setStudents] = useState<Student[]>(MOCKS?.students ?? []);
  const [attendanceRecords, setAttendanceRecords] = useState(MOCKS?.attendanceRecords ?? []);
  const [assignments, setAssignments] = useState(MOCKS?.assignments ?? []);
  const [grades, setGrades] = useState(MOCKS?.grades ?? []);
  const [candidates, setCandidates] = useState(MOCKS?.candidates ?? []);
  const [announcements, setAnnouncements] = useState(MOCKS?.announcements ?? []);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Show Toast Helper
  const showToast = (
    title: string,
    message?: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'success'
  ) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Restore sesi saat reload: token valid → identitas server, tanpa bypass.
  useEffect(() => {
    let cancelled = false;
    void SessionManager.restore().then((profile) => {
      if (cancelled) return;
      if (profile) {
        setSessionProfile(profile);
        setCurrentRole(profile.role);
        setIsLoggedIn(true);
        // Hormati deep-link URL bila peran boleh; jika tidak → halaman perannya.
        setActiveView(resolveInitialView(profile.role, window.location.pathname));
      }
      setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sesi habis di tengah kerja (401 dari API) → kembali ke tampilan publik + jelaskan.
  useEffect(() => {
    const onExpired = () => {
      setSessionProfile(null);
      setIsLoggedIn(false);
      setCurrentRole('public');
      setActiveView('cms');
      window.history.replaceState({}, '', '/');
      showToast('Sesi Berakhir', 'Sesi Anda berakhir. Silakan masuk kembali.', 'error');
    };
    window.addEventListener('lms:session-expired', onExpired);
    return () => window.removeEventListener('lms:session-expired', onExpired);
  }, []);

  // Timeout idle (FRD §3.1): 30 menit tanpa aktivitas → kembali ke tampilan publik.
  // Server tetap otoritas akhir (token kedaluwarsa → 401 → 'lms:session-expired').
  useEffect(() => {
    if (!isLoggedIn) return;

    let lastActivity = Date.now();
    const markActive = () => {
      lastActivity = Date.now();
    };
    const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity < IDLE_TIMEOUT_MS) return;

      window.clearInterval(interval);
      setIsLoggedIn(false);
      setSessionProfile(null);
      setCurrentRole('public');
      setActiveView('cms');
      void AuthService.logout();
      window.history.replaceState({}, '', '/');
      setAuditCount((prev) => prev + 1);
      showToast('Sesi Berakhir', 'Tidak ada aktivitas selama 30 menit. Silakan masuk kembali.', 'warning');
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, markActive));
      window.clearInterval(interval);
    };
  }, [isLoggedIn]);

  // Pemetaan role → view awal (peta bertipe di lib/AppRouter).
  function routeForRole(role: UserRole): ActiveModuleView {
    return ROLE_HOME[role] ?? 'dashboard';
  }

  // Guard pemilihan modul: peran portal tidak boleh membuka modul staf.
  const selectView = (view: ActiveModuleView) => {
    if (!canAccess(currentRole, view)) {
      showToast('Akses Ditolak', 'Peran Anda tidak memiliki akses ke modul tersebut.', 'error');
      setActiveView(ROLE_HOME[currentRole] ?? 'dashboard');
      setIsNavOpen(false);
      return;
    }
    setActiveView(view);
    setIsNavOpen(false);
  };

  // Esc menutup drawer navigasi (kebiasaan keyboard/pembaca layar).
  useEffect(() => {
    if (!isNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNavOpen]);

  // URL ↔ modul aktif: deep-link, tahan refresh, dan tombol back/forward browser.
  useEffect(() => {
    if (!isLoggedIn || currentRole === 'public') return;
    const target = pathForModule(activeView);
    if (window.location.pathname !== target) window.history.replaceState({}, '', target);
  }, [activeView, isLoggedIn, currentRole]);

  useEffect(() => {
    const onPopState = () => {
      if (!isLoggedIn) return;
      const view = moduleFromPath(window.location.pathname);
      if (view && canAccess(currentRole, view)) setActiveView(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isLoggedIn, currentRole]);

  // Ringkasan dashboard staf: ambil dari server saat sesi staf aktif.
  useEffect(() => {
    if (!isLoggedIn || !isStaffRole(currentRole)) {
      setDashboardSummary(null);
      return;
    }

    let cancelled = false;
    setDashboardLoading(true);
    void DashboardApiService.summary()
      .then((summary) => {
        if (!cancelled) setDashboardSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setDashboardSummary(null);
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentRole]);

  // Sukses login via API — satu-satunya jalan masuk ke dashboard/menu.
  const handleLoginSuccess = (role: UserRole, identifier: string) => {
    setSessionProfile({ name: identifier, role });
    setCurrentRole(role);
    setIsLoggedIn(true);
    setActiveView(routeForRole(role));
    setAuditCount((prev) => prev + 1);
    // Ambil nama asli dari server (bukan identifier) sekali setelah login.
    void AuthService.profile().then((profile) => {
      if (profile) setSessionProfile(profile);
    });
    showToast(
      'Login Berhasil',
      `Tampilan disesuaikan untuk peran: ${role.toUpperCase().replace('_', ' ')}`,
      'success'
    );
  };

  // Preview role DEV (TopDevBar): ganti tampilan TANPA login.
  // Tidak menyetel isLoggedIn — dashboard/menu tetap terkunci ProtectedRoute.
  const handlePreviewRole = (role: UserRole) => {
    setCurrentRole(role);
    setActiveView(routeForRole(role));
    setAuditCount((prev) => prev + 1);
    showToast(
      'Preview Role (DEV)',
      `Preview tampilan ${role.toUpperCase().replace('_', ' ')} — wajib login untuk akses data.`,
      'info'
    );
  };

  // Switch Role Handler (Auto-routes to the most relevant view for that role)
  const handleRoleChange = (role: UserRole) => {
    // LEGACY: dipertahankan sebagai alias preview DEV agar TopDevBar tidak rusak.
    // Sengaja TIDAK menyetel isLoggedIn — masuk dashboard/menu hanya via handleLoginSuccess.
    handlePreviewRole(role);
    return;
  };

  // Convert SPMB Candidate to Active Student
  const handleConvertCandidateToStudent = (candidate: SpmbCandidate) => {
    const newStudent: Student = {
      id: `STD-00${students.length + 1}`,
      nisn: candidate.nisn,
      nik: candidate.nik,
      name: candidate.name,
      gender: candidate.gender,
      kelas: candidate.chosenMajor === 'Rekayasa Perangkat Lunak' ? 'X RPL 1' : 'X TKJ 1',
      jurusan: candidate.chosenMajor,
      angkatan: '2026',
      parentName: candidate.parentName,
      parentPhone: candidate.parentPhone,
      photo: '',
      birthDate: candidate.birthDate,
      birthPlace: candidate.birthPlace,
      address: 'Jl. Merdeka No. 10, Jakarta Pusat',
    };
    setStudents([newStudent, ...students]);
  };

  // Profil tampilan: nama dari server saat login; label peran sebagai fallback
  // (mis. preview peran DEV yang tidak login). Tidak ada identitas palsu.
  const getUserProfile = () => {
    const roleLabel = currentRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const name = sessionProfile?.name?.trim() || (isLoggedIn ? 'Pengguna' : 'Belum Masuk');

    if (!sessionProfile) {
      return { name, roleDesc: `Preview Peran (DEV): ${roleLabel}`, avatar: initialsAvatar(name) };
    }

    return { name, roleDesc: roleLabel, avatar: initialsAvatar(name) };
  };

  const userProfile = getUserProfile();

  // Deep-link email reset password: /reset-password?token=...&email=...
  // Dirender standalone di atas semua alur state aplikasi.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/reset-password')) {
    const params = new URLSearchParams(window.location.search);
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <ModuleErrorBoundary>
          <Suspense fallback={<ModuleFallback />}>
            <ResetPasswordModule
              email={params.get('email') ?? ''}
              token={params.get('token') ?? ''}
              onShowToast={showToast}
              onSuccess={() => {
                window.history.replaceState({}, '', '/');
                setCurrentRole('super_admin');
                setIsLoggedIn(false);
              }}
            />
          </Suspense>
        </ModuleErrorBoundary>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // Sesi dicek dulu (restore token) agar reload tidak melempar ke login bila token valid.
  if (!sessionChecked && currentRole !== 'public') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ModuleFallback />
          <p className="mt-3 text-center text-xs text-slate-500">Memeriksa sesi login…</p>
        </div>
      </div>
    );
  }

  // Auth fallback dipakai ulang oleh guard + ProtectedRoute (single source).
  const authFallback = (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {import.meta.env.DEV && (
        <TopDevBar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          isMobileView={isMobileView}
          onToggleMobileView={() => setIsMobileView(!isMobileView)}
          onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
          auditCount={auditCount}
        />
      )}
      <ModuleErrorBoundary>
        <Suspense fallback={<ModuleFallback />}>
          <AuthModule onLoginSuccess={handleLoginSuccess} onShowToast={showToast} />
        </Suspense>
      </ModuleErrorBoundary>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {import.meta.env.DEV && (
        <SecurityAuditModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          activeRole={currentRole}
        />
      )}
    </div>
  );

  // If user is logged out and not in public site, show Auth Module
  if (!isLoggedIn && currentRole !== 'public') {
    return authFallback;
  }

  if (currentRole === 'public') {
    return (
      <>
        <CmsPublicModule
          news={MOCKS?.newsPosts ?? []}
          schoolConfig={schoolConfig}
          onGoToLogin={() => {
            setCurrentRole('super_admin');
            setIsLoggedIn(false);
          }}
          onGoToSpmb={() => {
            // Wajib login dulu: arahkan ke layar login, bukan langsung ke modul SPMB.
            setCurrentRole('calon_siswa');
            setIsLoggedIn(false);
            setActiveView('spmb');
          }}
          onShowToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <ProtectedRoute isAuthenticated={isLoggedIn} fallback={authFallback}>
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* 1. TOP DEV BAR (DEV ONLY): role switcher tidak pernah tampil di produksi */}
      {import.meta.env.DEV && (
        <TopDevBar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          isMobileView={isMobileView}
          onToggleMobileView={() => setIsMobileView(!isMobileView)}
          onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
          auditCount={auditCount}
        />
      )}

      {/* 2. NAVBAR: SCHOOL IDENTITY & USER STATUS */}
      <Navbar
          currentRole={currentRole}
          currentUserName={userProfile.name}
          currentUserRoleDesc={userProfile.roleDesc}
          userAvatar={userProfile.avatar}
          schoolConfig={schoolConfig}
          announcements={announcements}
          onLogout={() => {
            setIsLoggedIn(false);
            setSessionProfile(null);
            void AuthService.logout();
            window.history.replaceState({}, '', '/');
            showToast('Logout Berhasil', 'Anda telah keluar dari sesi akun.', 'info');
          }}
          onOpenSettings={() => selectView('settings')}
          onOpenPublicSite={() => {
            setCurrentRole('public');
            setActiveView('cms');
          }}
          onOpenNav={() => setIsNavOpen(true)}
        />

      {/* 2b. DRAWER NAVIGASI (< lg): sidebar desktop tersembunyi di layar kecil,
          tanpa ini staf tidak punya cara berpindah modul di ponsel/tablet. */}
      {isNavOpen &&
        currentRole !== 'siswa' &&
        currentRole !== 'orang_tua' &&
        currentRole !== 'calon_siswa' && (
          <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-nav-drawer">
            <button
              type="button"
              aria-label="Tutup menu navigasi"
              onClick={() => setIsNavOpen(false)}
              className="absolute inset-0 w-full bg-slate-900/40"
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-900">Menu Modul</span>
                <button
                  type="button"
                  onClick={() => setIsNavOpen(false)}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
                  aria-label="Tutup menu navigasi"
                  data-testid="btn-close-nav"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar
                  activeView={activeView}
                  onSelectView={selectView}
                  onNavigate={() => setIsNavOpen(false)}
                  testIdPrefix="nav-drawer-menu"
                  className="flex w-full min-h-0 border-r-0"
                />
              </div>
            </div>
          </div>
        )}

      {/* 3. MAIN BODY CONTAINER */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar: Shown for Admin, Super Admin, Guru, Bendahara, Operator */}
        {currentRole !== 'siswa' &&
          currentRole !== 'orang_tua' &&
          currentRole !== 'calon_siswa' && (
            <Sidebar activeView={activeView} onSelectView={selectView} />
          )}

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-8 min-w-0">
          <MobileShellWrapper
            isMobileView={isMobileView && (currentRole === 'siswa' || currentRole === 'orang_tua')}
          >
            {/* RENDER ACTIVE MODULE VIEW */}
            {activeView === 'dashboard' && (
              <AdminDashboardOverview
                onNavigate={selectView}
                attendanceTodayCount={dashboardSummary?.attendance_today ?? 0}
                totalStudents={dashboardSummary?.total_students ?? 0}
                attendanceRate={dashboardSummary?.attendance_rate ?? null}
                activeCbtExams={dashboardSummary?.active_cbt_exams ?? null}
                isLoading={dashboardLoading}
              />
            )}

            {activeView === 'kts' && (
              <KtsModule
                students={students}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
              />
            )}

            {activeView === 'attendance' && (
              <AttendanceModule
                records={attendanceRecords}
                students={students}
                onAddRecord={(rec) => setAttendanceRecords([rec, ...attendanceRecords])}
                onShowToast={showToast}
              />
            )}

            {activeView === 'whatsapp' && (
              <WhatsAppModule
                schoolConfig={schoolConfig}
                onUpdateConfig={(cfg) => setSchoolConfig(cfg)}
                onShowToast={showToast}
              />
            )}

            {activeView === 'parent' && (
              <ParentPortalModule
                student={students[0]}
                attendanceRecords={attendanceRecords}
                grades={grades}
                sppProfile={MOCKS?.sppProfile}
                schedule={MOCKS?.schedule ?? []}
                announcements={announcements}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
              />
            )}

            {activeView === 'student' && (
              <StudentPortalModule
                student={students[0]}
                schedule={MOCKS?.schedule ?? []}
                assignments={assignments}
                materials={MOCKS?.materials ?? []}
                grades={grades}
                schoolConfig={schoolConfig}
                onUpdateAssignment={(updated) => {
                  setAssignments(assignments.map((a) => (a.id === updated.id ? updated : a)));
                }}
                onShowToast={showToast}
                onOpenCbtExam={() => setActiveView('cbt')}
              />
            )}

            {activeView === 'cbt' && (
              <CbtExamModule exams={MOCKS?.cbtExams ?? []} onShowToast={showToast} />
            )}

            {activeView === 'library' && (
              <LibraryModule books={MOCKS?.libraryBooks ?? []} onShowToast={showToast} />
            )}

            {activeView === 'finance' && (
              <FinanceModule
                sppProfile={MOCKS?.sppProfile}
                students={students}
                cashTransactions={MOCKS?.cashTransactions ?? []}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
              />
            )}

            {activeView === 'spmb' && (
              <SpmbModule
                waves={MOCKS?.spmbWaves ?? []}
                candidates={candidates}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
                onConvertCandidateToStudent={handleConvertCandidateToStudent}
              />
            )}

            {activeView === 'academic' && (
              <AcademicModule
                students={students}
                subjects={MOCKS?.subjects ?? []}
                schedule={MOCKS?.schedule ?? []}
                grades={grades}
                announcements={announcements}
                schoolConfig={schoolConfig}
                onUpdateGrades={(updated) => setGrades(updated)}
                onAddAnnouncement={(anc) => setAnnouncements([anc, ...announcements])}
                onShowToast={showToast}
              />
            )}

            {activeView === 'cms' && (
              <CmsPublicModule
                news={MOCKS?.newsPosts ?? []}
                schoolConfig={schoolConfig}
                onGoToLogin={() => {
                  setCurrentRole('super_admin');
                  setIsLoggedIn(false);
                }}
                onGoToSpmb={() => {
                  setCurrentRole('calon_siswa');
                  setActiveView('spmb');
                }}
                onShowToast={showToast}
              />
            )}

            {activeView === 'cms_admin' && (
              <CmsAdminModule onShowToast={showToast} />
            )}

            {activeView === 'settings' && (
              <SettingsModule
                config={schoolConfig}
                onSaveConfig={(updated) => setSchoolConfig(updated)}
                onShowToast={showToast}
              />
            )}
          </MobileShellWrapper>
        </main>
      </div>

      {/* Global Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Security Analyst & RBAC Audit Modal (DEV only) */}
      {import.meta.env.DEV && (
        <SecurityAuditModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          activeRole={currentRole}
        />
      )}
    </div>
    </ProtectedRoute>
  );
}

export default App;
