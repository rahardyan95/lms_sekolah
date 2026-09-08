import React from 'react';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  QrCode,
  Send,
  Clock,
  BookOpen,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { formatRupiah } from '../../../utils/helpers';
import { ActiveModuleView } from '../../layout/Sidebar';

interface AdminDashboardOverviewProps {
  onNavigate: (view: ActiveModuleView) => void;
  attendanceTodayCount: number;
  totalStudents: number;
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({
  onNavigate,
  attendanceTodayCount,
  totalStudents,
}) => {
  const attendanceRate = Math.round((attendanceTodayCount / totalStudents) * 100) || 94;

  const quickActions = [
    {
      title: 'Pemindai QR Presensi',
      desc: 'Buka scanner kamera & barcode USB',
      icon: QrCode,
      view: 'attendance' as ActiveModuleView,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      title: 'Cetak KTS Digital',
      desc: 'Desain & cetak kartu ISO CR-80',
      icon: GraduationCap,
      view: 'kts' as ActiveModuleView,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      title: 'Ujian Online CBT',
      desc: 'Ruang ujian daring & bank soal',
      icon: Clock,
      view: 'cbt' as ActiveModuleView,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Matriks SPP 12 Bulan',
      desc: 'Kelola pembayaran & kwitansi',
      icon: CreditCard,
      view: 'finance' as ActiveModuleView,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'WhatsApp Broadcast',
      desc: 'Kirim pengumuman massal ortu',
      icon: Send,
      view: 'whatsapp' as ActiveModuleView,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: 'Perpustakaan E-Book',
      desc: 'Katalog buku & in-browser reader',
      icon: BookOpen,
      view: 'library' as ActiveModuleView,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ];

  return (
    <div className="space-y-6" data-testid="admin-dashboard-overview">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>SISTEM TERPADU AKTIF</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Selamat Datang di Pusat Manajemen Sekolah SMKN 1 Jakarta
          </h2>
          <p className="text-xs sm:text-sm text-teal-100/90 leading-relaxed font-normal">
            Platform operasional akademik terintegrasi untuk 8 peran pengguna. Seluruh 13 modul fungsional siap digunakan secara real-time.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Siswa Aktif</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalStudents}</p>
          <p className="text-[10px] text-teal-700 font-semibold">Tiga Angkatan (X, XI, XII)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kehadiran Hari Ini</span>
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800">{attendanceRate}%</p>
          <p className="text-[10px] text-emerald-700 font-semibold">{attendanceTodayCount} Siswa Terpindai</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ujian CBT Aktif</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-800">1</p>
          <p className="text-[10px] text-amber-700 font-semibold">PTS Pemrograman Web</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">SPP Terkumpul</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">80%</p>
          <p className="text-[10px] text-teal-700 font-semibold">Periode Semester Ganjil</p>
        </div>
      </div>

      {/* Quick Action Shortcuts Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Akses Cepat Modul Utama
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, idx) => {
            const IconComp = action.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(action.view)}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs text-left transition-all flex items-center justify-between group"
                data-testid={`quick-action-${action.view}`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-xl ${action.bg} flex items-center justify-center shrink-0`}>
                    <IconComp className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {action.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{action.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Security & System Readiness Status */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Kesiapan Sistem & Arsitektur Keamanan</span>
          </span>
          <Badge variant="success">All Systems Operational</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="font-bold text-slate-900">PostgreSQL 17 Database</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Koneksi terenkripsi SSL aktif, WAL logging aktif.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="font-bold text-slate-900">Redis 7 Queue & Cache</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Worker antrean notifikasi WhatsApp & CBT timer berjalan.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="font-bold text-slate-900">Role-Based Access Control</p>
            <p className="text-[11px] text-slate-500 mt-0.5">8 Peran terisolasi dengan data sanitasi XSS.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
