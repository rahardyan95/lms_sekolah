import React, { useState, useEffect } from 'react';
import {
  Student,
  AttendanceRecord,
  StudentGrade,
  StudentSppProfile,
  ScheduleItem,
  Announcement,
  SchoolConfig,
} from '../../../types';
import {
  UserCheck,
  CalendarCheck,
  GraduationCap,
  CreditCard,
  Bell,
  MessageCircle,
  ExternalLink,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Smartphone,
  Phone,
  BookOpen,
  Download,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { EmptyState } from '../../common/EmptyState';
import {formatRupiah, formatDate, generateSvgQrMatrix, initialsAvatar} from '../../../utils/helpers';
import { ParentService } from '../../../services/DomainService';
import { TokenStorage } from '../../../services/TokenStorage';
import type { ServerSummary } from '../../../services/FinanceApiService';
import type { ServerGrade } from '../../../services/LmsApiService';
import { SettingsApiService } from '../../../services/OpsApiService';
import { AcademicApiService, type ServerAnnouncement, type ServerSchedule } from '../../../services/AcademicApiService';

interface ParentPortalModuleProps {
  student?: Student;
  attendanceRecords: AttendanceRecord[];
  grades: StudentGrade[];
  sppProfile?: StudentSppProfile;
  schedule: ScheduleItem[];
  announcements: Announcement[];
  schoolConfig: SchoolConfig;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const ParentPortalModule: React.FC<ParentPortalModuleProps> = ({
  student,
  attendanceRecords,
  grades,
  sppProfile,
  schedule,
  announcements,
  schoolConfig,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'presensi' | 'nilai' | 'spp' | 'jadwal' | 'kts'>('presensi');
  const [isKtsModalOpen, setIsKtsModalOpen] = useState(false);
  const [childQrSvg, setChildQrSvg] = useState('');
  const [childId, setChildId] = useState<string | null>(null);
  const [childServerQr, setChildServerQr] = useState('');
  const [ktsQrError, setKtsQrError] = useState(false);
  const [ktsDownloading, setKtsDownloading] = useState(false);
  const [schoolWaNumber, setSchoolWaNumber] = useState<string | null>(null);
  const [attendanceStale, setAttendanceStale] = useState(false);

  const [serverRecords, setServerRecords] = useState<AttendanceRecord[] | null>(null);
  const [serverInvoices, setServerInvoices] = useState<ServerSummary | null>(null);
  const [serverGrades, setServerGrades] = useState<ServerGrade[] | null>(null);
  const [serverSchedule, setServerSchedule] = useState<ServerSchedule[] | null>(null);
  const [serverAnnouncements, setServerAnnouncements] = useState<ServerAnnouncement[] | null>(null);
  const [serverStale, setServerStale] = useState(false);

  // QR kartu anak dibuat saat modal dibuka; encoder asinkron.
  useEffect(() => {
    if (!isKtsModalOpen || !student) {
      setChildQrSvg('');
      return;
    }
    let cancelled = false;
    void generateSvgQrMatrix(`NISN:${student.nisn}`, 100, '#0f172a').then((svg) => {
      if (!cancelled) setChildQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [isKtsModalOpen, student]);

  // Server-first semua tab: anak + presensi + tagihan + nilai + jadwal dari API bila login.
  // Gagal/offline → fallback props mock (DEV) + badge STALE dengan retry.
  const loadServerData = async (nisn: string | undefined, signal: { cancelled: boolean }) => {
    try {
      const children = await ParentService.children();
      const child = children.find((c) => c.nisn === nisn) ?? children[0];
      if (!child || signal.cancelled) return;
      setChildId(child.id);
      const [rows, invoices, gradesList] = await Promise.all([
        ParentService.studentAttendance(child.id, student ? [student] : []),
        ParentService.studentInvoices(child.id).catch(() => null),
        ParentService.studentGrades(child.id).catch(() => null),
      ]);
      if (signal.cancelled) return;
      if (rows.length > 0) setServerRecords(rows);
      if (invoices) setServerInvoices(invoices);
      if (gradesList) setServerGrades(gradesList);
      setServerStale(false);
      setAttendanceStale(false);
    } catch {
      if (!signal.cancelled) setServerStale(true);
    }
    try {
      const [sched, annc] = await Promise.all([
        AcademicApiService.schedules().catch(() => null),
        AcademicApiService.announcements().catch(() => null),
      ]);
      if (signal.cancelled) return;
      if (sched && sched.length > 0) setServerSchedule(sched);
      if (annc && annc.length > 0) setServerAnnouncements(annc);
    } catch {
      /* jadwal/pengumuman tetap mock */
    }
  };

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    const signal = { cancelled: false };
    void loadServerData(student?.nisn, signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.nisn]);

  // Fallback realtime presensi (FRD §5): polling 30 dtk, hanya saat tab terlihat.
  // Tanpa websocket; kegagalan poll menandai badge LIVE menjadi STALE.
  useEffect(() => {
    if (!TokenStorage.hasSession() || !childId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void ParentService.studentAttendance(childId, student ? [student] : [])
        .then((rows) => {
          if (rows.length > 0) setServerRecords(rows);
          setAttendanceStale(false);
        })
        .catch(() => setAttendanceStale(true));
    }, 30_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, student?.nisn]);

  // QR KTS anak dari server (token bertanda tangan), dimuat saat tab KTS dibuka.
  useEffect(() => {
    if (activeTab !== 'kts') return;
    const target = childId ?? student?.id;
    if (!target || !TokenStorage.hasSession()) return;
    let cancelled = false;
    setKtsQrError(false);
    void ParentService.ktsQrSvg(target)
      .then((svg) => {
        if (!cancelled) setChildServerQr(svg);
      })
      .catch(() => {
        if (cancelled) return;
        setChildServerQr('');
        setKtsQrError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, childId, student?.id]);

  // Nomor WhatsApp sekolah resmi untuk tombol kontak (wa.me).
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void SettingsApiService.get()
      .then((settings) => {
        if (!cancelled) setSchoolWaNumber(settings.school_wa_number ?? null);
      })
      .catch(() => {
        /* biarkan null → tombol kontak nonaktif */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const waDigits = (schoolWaNumber ?? '').replace(/[^0-9]/g, '');
  const waHref = waDigits ? `https://wa.me/${waDigits}` : null;

  const handleDownloadKts = async () => {
    const target = childId ?? student?.id;
    if (!target || !student) return;
    setKtsDownloading(true);
    try {
      const blob = await ParentService.ktsCardBlob(target);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kts-${student.nisn}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onShowToast('KTS Diunduh', `Kartu tanda pelajar ${student.name} tersimpan sebagai PDF.`, 'success');
    } catch {
      onShowToast('Gagal Mengunduh KTS', 'Kartu tidak dapat diambil dari server. Coba lagi.', 'error');
    } finally {
      setKtsDownloading(false);
    }
  };

  const effectiveRecords = serverRecords ?? attendanceRecords;

  // Student specific records
  const studentAttendance = effectiveRecords.filter((r) => !student || r.nisn === student.nisn);
  const propGrades = grades.filter((g) => !student || g.nisn === student.nisn);
  const gradesLive = serverGrades !== null;
  const effectiveServerGrades = (serverGrades ?? []).map((g) => ({
    id: g.id,
    subjectId: g.subject?.code ?? '',
    subjectName: g.subject?.name ?? 'Mata Pelajaran',
    nilaiTugas: g.nilai_tugas ?? 0,
    nilaiUTS: g.nilai_uts ?? 0,
    nilaiUAS: g.nilai_uas ?? 0,
    nilaiAkhir: g.nilai_akhir ?? 0,
    predikat: (g.predikat ?? '-') as 'A' | 'B' | 'C' | 'D',
    catatanGuru: g.catatan_guru ?? '',
  }));
  const studentGrades = gradesLive ? effectiveServerGrades : propGrades;
  const effectiveSchedule = serverSchedule !== null
    ? serverSchedule.map((s) => ({
        id: s.id, day: s.day as ScheduleItem['day'], timeStart: s.time_start.slice(0, 5),
        timeEnd: s.time_end.slice(0, 5), kelas: s.kelas, subjectName: s.subject_name,
        teacherName: s.teacher_name, room: s.room ?? '-',
      }))
    : schedule;
  const effectiveAnnouncements = serverAnnouncements !== null
    ? serverAnnouncements.map((a) => ({
        id: a.id, title: a.title, targetRole: a.target_role as Announcement['targetRole'],
        date: (a.date ?? a.created_at).slice(0, 10), content: a.content, isImportant: a.is_important,
      }))
    : announcements;
  const sppLive = serverInvoices !== null;
  const sppTotals = sppLive
    ? {
        total: serverInvoices!.total_tagihan,
        paid: serverInvoices!.total_dibayar,
        rest: serverInvoices!.sisa,
      }
    : sppProfile
      ? { total: sppProfile.totalTagihan, paid: sppProfile.totalDibayar, rest: sppProfile.sisaTagihan }
      : null;

  // Attendance stats
  const totalDays = studentAttendance.length || 1;
  const hadirCount = studentAttendance.filter((r) => r.status === 'Hadir').length;
  const terlambatCount = studentAttendance.filter((r) => r.status === 'Terlambat').length;
  const sakitIzinCount = studentAttendance.filter((r) => r.status === 'Sakit' || r.status === 'Izin').length;
  const alpaCount = studentAttendance.filter((r) => r.status === 'Alpa').length;
  const attendanceRate = Math.round(((hadirCount + terlambatCount) / totalDays) * 100);

  // Grade averages
  const avgGrade =
    studentGrades.length > 0
      ? Math.round(studentGrades.reduce((acc, g) => acc + g.nilaiAkhir, 0) / studentGrades.length)
      : null;

  const liveBadge = (testId: string, label = 'LIVE API') => (
    <span
      className="ml-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono normal-case"
      data-testid={testId}
    >
      {label}
    </span>
  );

  const staleBar = serverStale && TokenStorage.hasSession() && (
    <div
      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"
      role="status"
      data-testid="parent-stale-bar"
    >
      <span>Data server tidak dapat dimuat — menampilkan data lokal. Coba lagi.</span>
      <button
        type="button"
        onClick={() => void loadServerData(student?.nisn, { cancelled: false })}
        className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold hover:bg-amber-100"
        data-testid="btn-parent-retry"
      >
        Muat Ulang
      </button>
    </div>
  );

  // Direct WhatsApp contact action
  const handleContactSchool = () => {
    onShowToast('Hubungi Sekolah via WhatsApp', 'Membuka tautan chat WhatsApp resmi Wali Kelas: 0812-9087-1234', 'info');
  };

  return (
    <div className="space-y-6" data-testid="parent-portal-module">
      {staleBar}
      {/* Student Profile Header Bar — hanya bila data anak tersedia dari server */}
      {student ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={student.photo !== '' ? student.photo : initialsAvatar(student.name)}
              alt={student.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500 shadow-sm shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                  PORTAL ORANG TUA
                </span>
                <span className="text-xs text-slate-500">Tahun Ajaran {schoolConfig.academicYear}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{student.name}</h2>
              <p className="text-xs text-slate-500 font-mono">
                NISN: {student.nisn} — Kelas {student.kelas} ({student.jurusan})
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsKtsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              data-testid="btn-parent-view-kts"
            >
              <QrCode className="w-4 h-4 text-slate-600" />
              <span>KTS Digital Anak</span>
            </button>
            <button
              onClick={handleContactSchool}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs"
              data-testid="btn-parent-wa-contact"
            >
              <Phone className="w-4 h-4" />
              <span>Hubungi Wali Kelas (WA)</span>
            </button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Data anak belum tersedia"
          message="Profil anak dimuat dari server. Pastikan akun orang tua sudah tertaut ke data siswa."
          testId="parent-student-empty-state"
        />
      )}

      {/* 5 Integrated Tabs Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('presensi')}
          className={`flex-1 min-w-[130px] min-h-11 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'presensi'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-presensi"
        >
          <CalendarCheck className="w-4 h-4" />
          <span>1. Kehadiran ({attendanceRate}%)</span>
        </button>

        <button
          onClick={() => setActiveTab('nilai')}
          className={`flex-1 min-w-[130px] min-h-11 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'nilai'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-nilai"
        >
          <Award className="w-4 h-4" />
          <span>2. Nilai Rapor (Rata-rata: {avgGrade ?? '—'})</span>
        </button>

        <button
          onClick={() => setActiveTab('spp')}
          className={`flex-1 min-w-[130px] min-h-11 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'spp'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-spp"
        >
          <CreditCard className="w-4 h-4" />
          <span>3. SPP & Keuangan</span>
        </button>

        <button
          onClick={() => setActiveTab('jadwal')}
          className={`flex-1 min-w-[130px] min-h-11 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'jadwal'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-jadwal"
        >
          <Clock className="w-4 h-4" />
          <span>4. Jadwal & Pengumuman</span>
        </button>

        <button
          onClick={() => setActiveTab('kts')}
          className={`flex-1 min-w-[130px] min-h-11 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'kts'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="tab-parent-kts"
        >
          <QrCode className="w-4 h-4" />
          <span>5. KTS & Kontak</span>
        </button>
      </div>

      {/* TAB CONTENT 1: PRESENSI KEHADIRAN */}
      {activeTab === 'presensi' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Persentase Hadir</span>
              <p className="text-2xl font-black text-teal-700 mt-1">{attendanceRate}%</p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-teal-700 h-full rounded-full" style={{ width: `${attendanceRate}%` }} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700">Tepat Waktu</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{hadirCount} Hari</p>
              <p className="text-[10px] text-emerald-700 mt-1">Masuk sebelum 07:00</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-amber-700">Terlambat</span>
              <p className="text-2xl font-black text-amber-800 mt-1">{terlambatCount} Hari</p>
              <p className="text-[10px] text-amber-700 mt-1">Notifikasi WA terkirim</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Izin / Sakit / Alpa</span>
              <p className="text-2xl font-black text-slate-700 mt-1">{sakitIzinCount + alpaCount} Hari</p>
              <p className="text-[10px] text-slate-500 mt-1">Surat terlampir</p>
            </div>
          </div>

          {/* Daily Records List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Riwayat Presensi Harian Putra/Putri Anda{' '}
              {serverRecords !== null && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono normal-case ${
                    attendanceStale
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  data-testid="parent-live-badge"
                  title={attendanceStale ? 'Penyegaran terakhir gagal — data mungkin tidak terbaru.' : 'Tersinkron dengan server.'}
                >
                  {attendanceStale ? 'STALE' : 'LIVE API'}
                </span>
              )}
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Jam Masuk</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Catatan / Keterangan</th>
                    <th className="p-3.5 text-right">Notifikasi WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentAttendance.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80">
                      <td className="p-3.5 font-medium text-slate-800">{formatDate(rec.date)}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{rec.timeIn}</td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            rec.status === 'Hadir'
                              ? 'success'
                              : rec.status === 'Terlambat'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {rec.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-slate-600">{rec.notes || '-'}</td>
                      <td className="p-3.5 text-right font-mono text-[11px] text-emerald-700 font-medium">
                        Terkirim ke 0812****456
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: NILAI AKADEMIS */}
      {activeTab === 'nilai' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Nilai resmi yang sudah dipublish (guru submit, wali publish)</span>
            {gradesLive && liveBadge('parent-nilai-live')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentGrades.map((g) => (
              <div
                key={g.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider font-mono">
                        {g.subjectId}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{g.subjectName}</h4>
                    </div>
                    <span className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold flex items-center justify-center text-xs">
                      {g.predikat}
                    </span>
                  </div>

                  {/* Grades breakdown grid */}
                  <div className="grid grid-cols-4 gap-2 mt-4 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">Tugas</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{g.nilaiTugas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">UTS</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{g.nilaiUTS}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">UAS</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{g.nilaiUAS}</p>
                    </div>
                    <div className="bg-white rounded-lg p-1 border border-slate-200">
                      <p className="text-[10px] text-teal-700 font-bold">Akhir</p>
                      <p className="text-sm font-black text-teal-800">{g.nilaiAkhir}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-100 text-[11px] text-teal-900 leading-relaxed mt-2">
                  <strong>Catatan Guru:</strong> &ldquo;{g.catatanGuru}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: SPP & KEUANGAN */}
      {activeTab === 'spp' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Ringkasan tagihan resmi dari server keuangan</span>
            {sppLive && liveBadge('parent-spp-live')}
          </div>
          {/* Billing Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Tagihan SPP (12 Bulan)</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{sppTotals ? formatRupiah(sppTotals.total) : '—'}</p>
              <p className="text-[11px] text-slate-500 mt-1">Tarif Rp 500.000 / bulan</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-xs text-emerald-700 font-medium">Sudah Terbayar</span>
              <p className="text-xl font-bold text-emerald-800 mt-1">{sppTotals ? formatRupiah(sppTotals.paid) : '—'}</p>
              <p className="text-[11px] text-emerald-700 mt-1">Terverifikasi Bendahara</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <span className="text-xs text-rose-700 font-medium">Sisa Tagihan Berjalan</span>
              <p className="text-xl font-bold text-rose-800 mt-1">{sppTotals ? formatRupiah(sppTotals.rest) : '—'}</p>
              <p className="text-[11px] text-rose-600 mt-1">Sesuai invoice aktif</p>
            </div>
          </div>

          {sppLive && serverInvoices && (
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-3" data-testid="parent-invoices-live">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Tagihan Aktif (Server)</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {serverInvoices.invoices.map((inv) => (
                  <div key={inv.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{inv.title}</p>
                      <p className="text-slate-500 font-mono text-[11px]">
                        {inv.status.toUpperCase()} · {formatRupiah(inv.paid_amount)}/{formatRupiah(inv.amount)}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg font-bold ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {inv.status === 'paid' ? 'LUNAS' : `SISA ${formatRupiah(inv.amount - inv.paid_amount)}`}
                    </span>
                  </div>
                ))}
                {serverInvoices.invoices.length === 0 && (
                  <p className="p-3 text-xs text-slate-500">Belum ada tagihan aktif.</p>
                )}
              </div>
            </div>
          )}

          {/* 12-Month Matrix Table — hanya bila profil SPP tersedia dari server/mock DEV */}
          {sppProfile && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Rincian Status Pembayaran SPP 12 Bulan (Tahun Ajaran 2026/2027)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sppProfile.months.map((m) => (
                <div
                  key={m.month}
                  className={`p-3 rounded-xl border text-xs text-center space-y-1.5 transition-all ${
                    m.status === 'Lunas'
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <p className="font-bold text-[11px] truncate">{m.month}</p>
                  <p className="font-mono text-slate-500 text-[10px]">{formatRupiah(m.fee)}</p>
                  <Badge variant={m.status === 'Lunas' ? 'success' : 'neutral'} size="sm">
                    {m.status}
                  </Badge>
                  {m.receiptNumber && (
                    <p className="text-[9px] font-mono text-slate-500 mt-1">{m.receiptNumber}</p>
                  )}
                </div>
              ))}
            </div>

            {/* School Bank Account info for transfers */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-bold text-slate-900">Rekening Resmi Pembayaran Sekolah:</p>
                <p className="text-slate-600 mt-0.5 font-mono">
                  Bank DKI Virtual Account: <strong>8901 0071 8293 8400</strong> (A.n. SMK Negeri 1 Jakarta)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pembayaran melalui VA akan otomatis diverifikasi sistem dalam 5 menit.
                </p>
              </div>
              <button
                onClick={() => onShowToast('Nomor VA Disalin', 'Nomor Virtual Account disalin ke clipboard.', 'success')}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 text-xs shrink-0"
              >
                Salin Nomor VA
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: JADWAL & PENGUMUMAN */}
      {activeTab === 'jadwal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Timetable */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Jadwal Pelajaran KBM</span>
              {serverSchedule !== null && liveBadge('parent-schedule-live')}
            </h4>

            <div className="space-y-2.5">
              {effectiveSchedule.map((sch) => (
                <div
                  key={sch.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 shrink-0">
                      {sch.timeStart} - {sch.timeEnd}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{sch.subjectName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{sch.teacherName}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    {sch.room}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-600" />
              <span>Pengumuman Resmi Sekolah</span>
              {serverAnnouncements !== null && liveBadge('parent-annc-live')}
            </h4>

            <div className="space-y-3">
              {effectiveAnnouncements.map((anc) => (
                <div
                  key={anc.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">{anc.date}</span>
                    {anc.isImportant && <Badge variant="warning" size="sm">Penting</Badge>}
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">{anc.title}</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">{anc.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: KTS & KONTAK SEKOLAH */}
      {activeTab === 'kts' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4" data-testid="parent-kts-preview">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Kartu Tanda Pelajar Digital Anak</span>
            </h4>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-40 h-40 p-3 rounded-2xl border border-slate-200 bg-white shrink-0 flex items-center justify-center">
                <div
                  className="w-full h-full flex items-center justify-center"
                  data-testid="parent-kts-qr"
                  dangerouslySetInnerHTML={{ __html: childServerQr }}
                />
              </div>

              <div className="flex-1 space-y-3 text-xs text-slate-600">
                <p>
                  QR ini adalah token presensi bertanda tangan untuk{' '}
                  <strong className="text-slate-900">{student?.name ?? 'anak Anda'}</strong>{' '}
                  {student ? <span className="font-mono">(NISN {student.nisn})</span> : null}. Kartu dicetak pada ukuran CR-80
                  (85,6 × 54 mm) dan berlaku sampai lulus.
                </p>
                {!childServerQr && (
                  <p className="text-[11px] text-slate-500" data-testid="parent-kts-qr-hint">
                    {ktsQrError ? 'QR server tidak dapat dimuat saat ini.' : 'Memuat QR dari server…'}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleDownloadKts()}
                    disabled={ktsDownloading || !(childId ?? student?.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="btn-parent-kts-pdf"
                  >
                    <Download className="w-4 h-4" />
                    <span>{ktsDownloading ? 'Menyiapkan PDF…' : 'Unduh KTS (PDF)'}</span>
                  </button>

                  {waHref ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs"
                      data-testid="btn-contact-school"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Hubungi Sekolah via WhatsApp</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Nomor WhatsApp sekolah belum diatur pada menu Pengaturan."
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-400 bg-slate-100 rounded-xl cursor-not-allowed"
                      data-testid="btn-contact-school"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Nomor WA sekolah belum diatur</span>
                    </button>
                  )}
                </div>
                {!waHref && (
                  <p className="text-[11px] text-slate-500">
                    Admin sekolah belum mengisi <span className="font-mono">school_wa_number</span> pada Pengaturan.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Child KTS Modal */}
      {student && (
      <Modal
        isOpen={isKtsModalOpen}
        onClose={() => setIsKtsModalOpen(false)}
        title={`KTS Digital: ${student.name}`}
        subtitle={`NISN: ${student.nisn} — Berlaku s.d. Lulus`}
        maxWidth="md"
        dataTestId="child-kts-modal"
      >
        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          <div className="w-full aspect-[85.6/54] rounded-2xl overflow-hidden border border-slate-300 p-4 bg-white flex flex-col justify-between shadow-xl">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-teal-700 text-white">
              <GraduationCap className="w-5 h-5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{schoolConfig.name}</p>
                <p className="text-[9px] text-teal-100">KARTU TANDA PELAJAR DIGITAL</p>
              </div>
            </div>

            <div className="flex items-center gap-3 my-auto">
              <img
                src={student.photo !== '' ? student.photo : initialsAvatar(student.name)}
                alt={student.name}
                className="w-16 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 text-xs space-y-0.5">
                <p className="font-bold text-slate-900">{student.name}</p>
                <p className="font-mono text-teal-700 font-bold text-[11px]">{student.nisn}</p>
                <p className="text-slate-600 text-[11px]">{student.kelas} — {student.jurusan}</p>
              </div>
              <div
                className="w-16 h-16 p-1 rounded-lg border border-slate-200 bg-white shrink-0"
                dangerouslySetInnerHTML={{ __html: childQrSvg }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsKtsModalOpen(false)}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Tutup Pratinjau
          </button>
        </div>
      </Modal>
      )}
    </div>
  );
};
