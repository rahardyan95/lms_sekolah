import React from 'react';
import { UserRole } from '../../types';
import {
  ShieldAlert,
  Smartphone,
  Monitor,
  UserCheck,
  Globe,
  Lock,
  ChevronDown,
} from 'lucide-react';

interface TopDevBarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  isMobileView: boolean;
  onToggleMobileView: () => void;
  onOpenSecurityAudit: () => void;
  auditCount: number;
}

export const TopDevBar: React.FC<TopDevBarProps> = ({
  currentRole,
  onRoleChange,
  isMobileView,
  onToggleMobileView,
  onOpenSecurityAudit,
  auditCount,
}) => {
  // Tool developer: hanya boleh ada di development. Di production komponen ini
  // tidak merender apa pun sehingga role-switcher tidak pernah bocor ke publik.
  if (import.meta.env.PROD) {
    return null;
  }

  const rolesList: { role: UserRole; label: string; desc: string }[] = [
    { role: 'super_admin', label: 'Super Admin', desc: 'Kontrol Penuh & Konfigurasi' },
    { role: 'admin_tu', label: 'Admin / TU', desc: 'Master Data & Akademik' },
    { role: 'guru', label: 'Guru Pengampu', desc: 'Nilai, Materi & Tugas' },
    { role: 'bendahara', label: 'Bendahara', desc: 'SPP, Tagihan & Arus Kas' },
    { role: 'operator', label: 'Operator Presensi', desc: 'Scanner QR & Kartu Siswa' },
    { role: 'siswa', label: 'Siswa (Mobile)', desc: 'LMS, Tugas & Ujian CBT' },
    { role: 'orang_tua', label: 'Orang Tua', desc: 'Monitoring Presensi & SPP' },
    { role: 'calon_siswa', label: 'Calon Siswa', desc: 'Pendaftaran PPDB / SPMB' },
    { role: 'public', label: 'Website Publik', desc: 'Landing Page & CMS Sekolah' },
  ];

  return (
    <header
      className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-4 py-2 text-xs shadow-md"
      data-testid="top-dev-bar"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Brand / System Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-white">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-400 font-mono">SIAKAD</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-200">LMS TERPADU</span>
          </div>
          <span className="hidden md:inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            SMK Negeri 1 Jakarta (NPSN: 20108392)
          </span>
        </div>

        {/* Center: Role Switcher Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
          <span className="text-[11px] text-slate-300 font-medium mr-1 hidden sm:inline">
            Role Akses:
          </span>
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/80">
            {rolesList.map((item) => {
              const isActive = currentRole === item.role;
              return (
                <button
                  key={item.role}
                  onClick={() => onRoleChange(item.role)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                  data-testid={`switch-role-${item.role}`}
                  title={item.desc}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Security Audit & Mobile View Toggle */}
        <div className="flex items-center gap-2">
          {/* Mobile View Toggle (Relevant for Student and Parent portals) */}
          {(currentRole === 'siswa' || currentRole === 'orang_tua') && (
            <button
              onClick={onToggleMobileView}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border ${
                isMobileView
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              data-testid="toggle-mobile-shell-btn"
              title="Aktifkan/Nonaktifkan simulasi frame smartphone"
            >
              {isMobileView ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-teal-400" />
                  <span>Mode Desktop</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mode Smartphone</span>
                </>
              )}
            </button>
          )}

          {/* Security & RBAC Inspector Button */}
          <button
            onClick={onOpenSecurityAudit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors text-[11px] font-semibold"
            data-testid="open-security-audit-btn"
            title="Buka panel auditor keamanan & RBAC"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit Keamanan</span>
            <span className="w-4 h-4 rounded-full bg-slate-700 text-[10px] text-teal-300 flex items-center justify-center font-mono">
              {auditCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
