import React, { useState } from 'react';
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

// Common Components
import { TopDevBar } from './components/common/TopDevBar';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveModuleView } from './components/layout/Sidebar';
import { MobileShellWrapper } from './components/layout/MobileShellWrapper';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { SecurityAuditModal } from './components/security/SecurityAuditModal';

// Module Components
import { AuthModule } from './components/modules/auth/AuthModule';
import { AdminDashboardOverview } from './components/modules/dashboard/AdminDashboardOverview';
import { KtsModule } from './components/modules/kts/KtsModule';
import { AttendanceModule } from './components/modules/attendance/AttendanceModule';
import { WhatsAppModule } from './components/modules/whatsapp/WhatsAppModule';
import { ParentPortalModule } from './components/modules/parent/ParentPortalModule';
import { StudentPortalModule } from './components/modules/student/StudentPortalModule';
import { CbtExamModule } from './components/modules/cbt/CbtExamModule';
import { LibraryModule } from './components/modules/library/LibraryModule';
import { FinanceModule } from './components/modules/finance/FinanceModule';
import { SpmbModule } from './components/modules/spmb/SpmbModule';
import { AcademicModule } from './components/modules/academic/AcademicModule';
import { CmsPublicModule } from './components/modules/cms/CmsPublicModule';
import { SettingsModule } from './components/modules/settings/SettingsModule';

export function App() {
  // Global State
  const [currentRole, setCurrentRole] = useState<UserRole>('super_admin');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ActiveModuleView>('dashboard');
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [auditCount, setAuditCount] = useState<number>(3);

  // Core Data Stores
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>(initialSchoolConfig);
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [attendanceRecords, setAttendanceRecords] = useState(mockAttendanceRecords);
  const [assignments, setAssignments] = useState(mockAssignments);
  const [grades, setGrades] = useState(mockGrades);
  const [candidates, setCandidates] = useState(mockSpmbCandidates);
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
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

  // Switch Role Handler (Auto-routes to the most relevant view for that role)
  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    setIsLoggedIn(true);

    if (role === 'siswa') {
      setActiveView('student');
    } else if (role === 'orang_tua') {
      setActiveView('parent');
    } else if (role === 'calon_siswa') {
      setActiveView('spmb');
    } else if (role === 'guru') {
      setActiveView('academic');
    } else if (role === 'bendahara') {
      setActiveView('finance');
    } else if (role === 'operator') {
      setActiveView('attendance');
    } else if (role === 'public') {
      setActiveView('cms');
    } else {
      setActiveView('dashboard');
    }

    setAuditCount((prev) => prev + 1);
    showToast(
      'Role Berganti',
      `Tampilan disesuaikan untuk peran: ${role.toUpperCase().replace('_', ' ')}`,
      'info'
    );
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
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      birthDate: candidate.birthDate,
      birthPlace: candidate.birthPlace,
      address: 'Jl. Merdeka No. 10, Jakarta Pusat',
    };
    setStudents([newStudent, ...students]);
  };

  // Get User Profile Metadata based on role
  const getUserProfile = () => {
    switch (currentRole) {
      case 'siswa':
        return {
          name: students[0].name,
          roleDesc: `Siswa (${students[0].kelas})`,
          avatar: students[0].photo,
        };
      case 'orang_tua':
        return {
          name: `Bpk. ${students[0].parentName}`,
          roleDesc: `Orang Tua / Wali (${students[0].name})`,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        };
      case 'guru':
        return {
          name: mockTeachers[0].name,
          roleDesc: `${mockTeachers[0].title} — Guru Pengampu`,
          avatar: mockTeachers[0].photo,
        };
      case 'bendahara':
        return {
          name: 'Ibu Endang Sulistyo, S.E.',
          roleDesc: 'Bendahara Keuangan Sekolah',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        };
      case 'operator':
        return {
          name: 'Rizky Ramadhan',
          roleDesc: 'Operator Presensi & Kartu Siswa',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        };
      case 'calon_siswa':
        return {
          name: 'Muhammad Dimas Saputra',
          roleDesc: 'Pendaftar PPDB Online 2026',
          avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
        };
      case 'admin_tu':
        return {
          name: 'Dra. Siti Aminah',
          roleDesc: 'Kepala Tata Usaha (Admin TU)',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        };
      case 'super_admin':
      default:
        return {
          name: 'Super Administrator',
          roleDesc: 'Tim IT & Pengembang Sistem',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
        };
    }
  };

  const userProfile = getUserProfile();

  // If user is logged out and not in public site, show Auth Module
  if (!isLoggedIn && currentRole !== 'public') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
        <TopDevBar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          isMobileView={isMobileView}
          onToggleMobileView={() => setIsMobileView(!isMobileView)}
          onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
          auditCount={auditCount}
        />
        <AuthModule
          onLoginSuccess={(role) => {
            setCurrentRole(role);
            setIsLoggedIn(true);
            handleRoleChange(role);
          }}
          onShowToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <SecurityAuditModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          activeRole={currentRole}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* 1. TOP DEV BAR: ROLE SWITCHER & ENVIRONMENT BAR */}
      <TopDevBar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        isMobileView={isMobileView}
        onToggleMobileView={() => setIsMobileView(!isMobileView)}
        onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
        auditCount={auditCount}
      />

      {/* 2. NAVBAR: SCHOOL IDENTITY & USER STATUS */}
      {currentRole !== 'public' && (
        <Navbar
          currentRole={currentRole}
          currentUserName={userProfile.name}
          currentUserRoleDesc={userProfile.roleDesc}
          userAvatar={userProfile.avatar}
          schoolConfig={schoolConfig}
          announcements={announcements}
          onLogout={() => {
            setIsLoggedIn(false);
            showToast('Logout Berhasil', 'Anda telah keluar dari sesi akun.', 'info');
          }}
          onOpenSettings={() => setActiveView('settings')}
          onOpenPublicSite={() => {
            setCurrentRole('public');
            setActiveView('cms');
          }}
        />
      )}

      {/* 3. MAIN BODY CONTAINER */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar: Shown for Admin, Super Admin, Guru, Bendahara, Operator */}
        {currentRole !== 'public' &&
          currentRole !== 'siswa' &&
          currentRole !== 'orang_tua' &&
          currentRole !== 'calon_siswa' && (
            <Sidebar activeView={activeView} onSelectView={(v) => setActiveView(v)} />
          )}

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-8 min-w-0">
          <MobileShellWrapper
            isMobileView={isMobileView && (currentRole === 'siswa' || currentRole === 'orang_tua')}
          >
            {/* RENDER ACTIVE MODULE VIEW */}
            {activeView === 'dashboard' && (
              <AdminDashboardOverview
                onNavigate={(v) => setActiveView(v)}
                attendanceTodayCount={attendanceRecords.length}
                totalStudents={students.length}
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
                sppProfile={mockSppProfile}
                schedule={mockSchedule}
                announcements={announcements}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
              />
            )}

            {activeView === 'student' && (
              <StudentPortalModule
                student={students[0]}
                schedule={mockSchedule}
                assignments={assignments}
                materials={mockMaterials}
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
              <CbtExamModule exams={mockCbtExams} onShowToast={showToast} />
            )}

            {activeView === 'library' && (
              <LibraryModule books={mockLibraryBooks} onShowToast={showToast} />
            )}

            {activeView === 'finance' && (
              <FinanceModule
                sppProfile={mockSppProfile}
                students={students}
                cashTransactions={mockCashTransactions}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
              />
            )}

            {activeView === 'spmb' && (
              <SpmbModule
                waves={mockSpmbWaves}
                candidates={candidates}
                schoolConfig={schoolConfig}
                onShowToast={showToast}
                onConvertCandidateToStudent={handleConvertCandidateToStudent}
              />
            )}

            {activeView === 'academic' && (
              <AcademicModule
                students={students}
                subjects={mockSubjects}
                schedule={mockSchedule}
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
                news={mockNewsPosts}
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

      {/* Security Analyst & RBAC Audit Modal */}
      <SecurityAuditModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        activeRole={currentRole}
      />
    </div>
  );
}

export default App;
