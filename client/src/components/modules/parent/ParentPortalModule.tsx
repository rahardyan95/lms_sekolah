import React, { useState } from 'react';
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
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { formatRupiah, formatDate, generateSvgQrMatrix } from '../../../utils/helpers';

interface ParentPortalModuleProps {
  student: Student;
  attendanceRecords: AttendanceRecord[];
  grades: StudentGrade[];
  sppProfile: StudentSppProfile;
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
  const [activeTab, setActiveTab] = useState<'presensi' | 'nilai' | 'spp' | 'jadwal'>('presensi');
  const [isKtsModalOpen, setIsKtsModalOpen] = useState(false);

  // Student specific records
  const studentAttendance = attendanceRecords.filter((r) => r.nisn === student.nisn);
  const studentGrades = grades.filter((g) => g.nisn === student.nisn);

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
      : 88;

  // Direct WhatsApp contact action
  const handleContactSchool = () => {
    onShowToast('Hubungi Sekolah via WhatsApp', 'Membuka tautan chat WhatsApp resmi Wali Kelas: 0812-9087-1234', 'info');
  };

  return (
    <div className="space-y-6" data-testid="parent-portal-module">
      {/* Student Profile Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={student.photo}
            alt={student.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                PORTAL ORANG TUA
              </span>
              <span className="text-xs text-slate-400">Tahun Ajaran {schoolConfig.academicYear}</span>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
            data-testid="btn-parent-wa-contact"
          >
            <Phone className="w-4 h-4" />
            <span>Hubungi Wali Kelas (WA)</span>
          </button>
        </div>
      </div>

      {/* 4 Integrated Tabs Navigation */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('presensi')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'presensi'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-presensi"
        >
          <CalendarCheck className="w-4 h-4" />
          <span>1. Kehadiran ({attendanceRate}%)</span>
        </button>

        <button
          onClick={() => setActiveTab('nilai')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'nilai'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-nilai"
        >
          <Award className="w-4 h-4" />
          <span>2. Nilai Rapor (Rata-rata: {avgGrade})</span>
        </button>

        <button
          onClick={() => setActiveTab('spp')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'spp'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-spp"
        >
          <CreditCard className="w-4 h-4" />
          <span>3. SPP & Keuangan</span>
        </button>

        <button
          onClick={() => setActiveTab('jadwal')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'jadwal'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          data-testid="parent-tab-jadwal"
        >
          <Clock className="w-4 h-4" />
          <span>4. Jadwal & Pengumuman</span>
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
                <div className="bg-teal-600 h-full rounded-full" style={{ width: `${attendanceRate}%` }} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700">Tepat Waktu</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{hadirCount} Hari</p>
              <p className="text-[10px] text-emerald-600 mt-1">Masuk sebelum 07:00</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <span className="text-[11px] font-semibold text-amber-700">Terlambat</span>
              <p className="text-2xl font-black text-amber-800 mt-1">{terlambatCount} Hari</p>
              <p className="text-[10px] text-amber-600 mt-1">Notifikasi WA terkirim</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Izin / Sakit / Alpa</span>
              <p className="text-2xl font-black text-slate-700 mt-1">{sakitIzinCount + alpaCount} Hari</p>
              <p className="text-[10px] text-slate-400 mt-1">Surat terlampir</p>
            </div>
          </div>

          {/* Daily Records List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Riwayat Presensi Harian Putra/Putri Anda
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
                      <p className="text-[10px] text-slate-400 font-semibold">Tugas</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{g.nilaiTugas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">UTS</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{g.nilaiUTS}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">UAS</p>
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
          {/* Billing Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Tagihan SPP (12 Bulan)</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatRupiah(sppProfile.totalTagihan)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Tarif Rp 500.000 / bulan</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-xs text-emerald-700 font-medium">Sudah Terbayar</span>
              <p className="text-xl font-bold text-emerald-800 mt-1">{formatRupiah(sppProfile.totalDibayar)}</p>
              <p className="text-[11px] text-emerald-600 mt-1">8 Bulan Lunas Terverifikasi</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <span className="text-xs text-rose-700 font-medium">Sisa Tagihan Berjalan</span>
              <p className="text-xl font-bold text-rose-800 mt-1">{formatRupiah(sppProfile.sisaTagihan)}</p>
              <p className="text-[11px] text-rose-600 mt-1">Periode Maret s.d. Juni 2027</p>
            </div>
          </div>

          {/* 12-Month Matrix Table */}
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
                    <p className="text-[9px] font-mono text-slate-400 mt-1">{m.receiptNumber}</p>
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
        </div>
      )}

      {/* TAB CONTENT 4: JADWAL & PENGUMUMAN */}
      {activeTab === 'jadwal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Timetable */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Jadwal Pelajaran KBM (Senin)</span>
            </h4>

            <div className="space-y-2.5">
              {schedule.map((sch) => (
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
            </h4>

            <div className="space-y-3">
              {announcements.map((anc) => (
                <div
                  key={anc.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">{anc.date}</span>
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

      {/* Child KTS Modal */}
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
            <div className="flex items-center gap-3 p-2 rounded-xl bg-teal-600 text-white">
              <GraduationCap className="w-5 h-5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{schoolConfig.name}</p>
                <p className="text-[9px] text-teal-100">KARTU TANDA PELAJAR DIGITAL</p>
              </div>
            </div>

            <div className="flex items-center gap-3 my-auto">
              <img
                src={student.photo}
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
                dangerouslySetInnerHTML={{
                  __html: generateSvgQrMatrix(`NISN:${student.nisn}`, 100, '#0f172a'),
                }}
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
    </div>
  );
};
