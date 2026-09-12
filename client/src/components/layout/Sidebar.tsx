import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  CalendarCheck,
  MessageSquare,
  Users,
  Smartphone,
  Clock,
  BookOpen,
  CreditCard,
  UserPlus,
  GraduationCap,
  Globe,
  Newspaper,
  Settings,
} from 'lucide-react';

export type ActiveModuleView =
  | 'dashboard'
  | 'kts'
  | 'attendance'
  | 'whatsapp'
  | 'parent'
  | 'student'
  | 'cbt'
  | 'library'
  | 'finance'
  | 'spmb'
  | 'academic'
  | 'cms'
  | 'cms_admin'
  | 'settings';

interface SidebarProps {
  activeView: ActiveModuleView;
  onSelectView: (view: ActiveModuleView) => void;
  /** Dipanggil setelah modul dipilih — drawer mobile memakainya untuk menutup diri. */
  onNavigate?: () => void;
  /** Kelas pembungkus; default kolom desktop (tersembunyi < lg). */
  className?: string;
  /** Prefiks data-testid agar instance drawer tidak menabrak id instance desktop. */
  testIdPrefix?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onNavigate,
  className,
  testIdPrefix = 'sidebar-menu',
}) => {
  const menuSections = [
    {
      title: 'AKADEMIK & KEHADIRAN',
      items: [
        { id: 'dashboard' as ActiveModuleView, label: 'Dashboard Utama', icon: LayoutDashboard },
        { id: 'attendance' as ActiveModuleView, label: 'Presensi & Scanner QR', icon: CalendarCheck },
        { id: 'kts' as ActiveModuleView, label: 'KTS Digital ISO CR-80', icon: QrCode },
        { id: 'academic' as ActiveModuleView, label: 'Akademik & Nilai Massal', icon: GraduationCap },
      ],
    },
    {
      title: 'PEMBELAJARAN & SISWA',
      items: [
        { id: 'student' as ActiveModuleView, label: 'Portal Siswa & LMS', icon: Smartphone },
        { id: 'cbt' as ActiveModuleView, label: 'Ujian Online CBT', icon: Clock },
        { id: 'library' as ActiveModuleView, label: 'Perpustakaan & E-Book', icon: BookOpen },
        { id: 'parent' as ActiveModuleView, label: 'Portal Orang Tua', icon: Users },
      ],
    },
    {
      title: 'KEUANGAN & PENERIMAAN',
      items: [
        { id: 'finance' as ActiveModuleView, label: 'SPP & Buku Kas', icon: CreditCard },
        { id: 'spmb' as ActiveModuleView, label: 'PPDB / SPMB Online', icon: UserPlus },
      ],
    },
    {
      title: 'PUBLIKASI & SISTEM',
      items: [
        { id: 'whatsapp' as ActiveModuleView, label: 'WhatsApp Gateway', icon: MessageSquare },
        { id: 'cms' as ActiveModuleView, label: 'CMS & Web Sekolah', icon: Globe },
        { id: 'cms_admin' as ActiveModuleView, label: 'Kelola CMS & Berita', icon: Newspaper },
        { id: 'settings' as ActiveModuleView, label: 'Pengaturan Sistem', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`${className ?? 'hidden lg:flex min-h-[calc(100vh-6rem)]'} w-64 bg-white border-r border-slate-200 p-4 shrink-0 flex flex-col justify-between`}
      data-testid={testIdPrefix === 'sidebar-menu' ? 'admin-sidebar' : `${testIdPrefix}-panel`}
    >
      <div className="space-y-6">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              {section.title}
            </h4>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectView(item.id);
                      onNavigate?.();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 min-h-11 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    data-testid={`${testIdPrefix}-${item.id}`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-500'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer info */}
      <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-mono text-center">
        SMKN 1 JAKARTA • v1.1
      </div>
    </aside>
  );
};
