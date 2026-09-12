import React, { useState } from 'react';
import { UserRole, SchoolConfig, Announcement } from '../../types';
import {
  Bell,
  Search,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  GraduationCap,
  Globe,
  Settings,
  ExternalLink,
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  currentUserName: string;
  currentUserRoleDesc: string;
  userAvatar: string;
  schoolConfig: SchoolConfig;
  announcements: Announcement[];
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenPublicSite: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentUserName,
  currentUserRoleDesc,
  userAvatar,
  schoolConfig,
  announcements,
  onLogout,
  onOpenSettings,
  onOpenPublicSite,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav
      className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 sticky top-9 z-30 shadow-xs"
      data-testid="main-navbar"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: School Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
                {schoolConfig.name}
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase font-mono">
                {schoolConfig.akreditasi}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Tahun Ajaran {schoolConfig.academicYear} • Semester {schoolConfig.activeSemester}
            </p>
          </div>
        </div>

        {/* Right Actions: Public Site, Notifications, Profile */}
        <div className="flex items-center gap-3">
          {/* Public Website Button */}
          {currentRole !== 'public' && (
            <button
              onClick={onOpenPublicSite}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              title="Kunjungi Website Publik Sekolah"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Website Publik</span>
            </button>
          )}

          {/* Notifications Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative transition-colors"
              aria-label="Pemberitahuan"
              data-testid="btn-notification-bell"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-teal-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
            </button>

            {/* Notifications Menu */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3 z-50 text-xs animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">Pemberitahuan Sekolah</span>
                  <span className="text-[10px] font-mono text-teal-600">3 Baru</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {announcements.map((anc) => (
                    <div key={anc.id} className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/50 transition-colors">
                      <p className="font-bold text-slate-800 text-[11px] truncate">{anc.title}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{anc.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-left"
              data-testid="user-profile-menu-btn"
            >
              <img
                src={userAvatar}
                alt={currentUserName}
                className="w-7 h-7 rounded-lg object-cover border border-slate-300 shrink-0"
              />
              <div className="hidden md:block min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {currentUserName}
                </p>
                <p className="text-[10px] text-teal-700 font-semibold truncate leading-none mt-0.5">
                  {currentUserRoleDesc}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Profile Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1 animate-fadeIn">
                <div className="p-2.5 border-b border-slate-100">
                  <p className="font-bold text-slate-900">{currentUserName}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{currentUserRoleDesc}</p>
                </div>

                <button
                  onClick={() => {
                    onOpenSettings();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Pengaturan Sistem</span>
                </button>

                <button
                  onClick={() => {
                    onLogout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors font-semibold"
                  data-testid="btn-logout-menu"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
