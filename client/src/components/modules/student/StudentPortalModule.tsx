import React, { useState, useEffect } from 'react';
import {
  Student,
  ScheduleItem,
  Assignment,
  LearningMaterial,
  StudentGrade,
  SchoolConfig,
} from '../../../types';
import {
  Home,
  Calendar,
  FileCheck,
  Award,
  User,
  BookOpen,
  Clock,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  QrCode,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { EmptyState } from '../../common/EmptyState';
import {generateSvgQrMatrix, initialsAvatar} from '../../../utils/helpers';
import { LmsApiService, type ServerStudentSummary } from '../../../services/LmsApiService';
import { TokenStorage } from '../../../services/TokenStorage';

/** Format angka ringkasan server; `—` bila belum tersedia. */
const formatSummaryStat = (value: number | null | undefined, suffix = ''): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
};

interface StudentPortalModuleProps {
  student?: Student;
  schedule: ScheduleItem[];
  assignments: Assignment[];
  materials: LearningMaterial[];
  grades: StudentGrade[];
  schoolConfig: SchoolConfig;
  onUpdateAssignment: (assignment: Assignment) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onOpenCbtExam: () => void;
}

export const StudentPortalModule: React.FC<StudentPortalModuleProps> = ({
  student,
  schedule,
  assignments,
  materials,
  grades,
  schoolConfig,
  onUpdateAssignment,
  onShowToast,
  onOpenCbtExam,
}) => {
  const [activeBottomNav, setActiveBottomNav] = useState<'beranda' | 'jadwal' | 'tugas' | 'nilai' | 'profil'>('beranda');

  // Submit Assignment Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Server-first LMS: materi/tugas/nilai dari API bila login siswa.
  const [serverMaterials, setServerMaterials] = useState<LearningMaterial[] | null>(null);
  const [serverAssignments, setServerAssignments] = useState<Assignment[] | null>(null);
  const [serverGrades, setServerGrades] = useState<StudentGrade[] | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  // Ringkasan header (kehadiran bulan ini + rata-rata nilai) dari GET /lms/summary/mine.
  const [summary, setSummary] = useState<ServerStudentSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  // Identitas server-first: prop `student` hanya mock DEV. Di bundle produksi
  // (mock dihapus), profil dibangun dari GET /lms/summary/mine — tanpa ini
  // portal siswa selalu menampilkan EmptyState meski akun tertaut di server.
  const serverStudent: Student | null =
    student ??
    (summary?.nisn
      ? {
          id: 'mine',
          nisn: summary.nisn,
          nik: '',
          name: summary.name?.trim() || 'Siswa',
          gender: 'L',
          kelas: summary.class_name?.trim() || '-',
          jurusan: summary.major?.trim() || '-',
          angkatan: '',
          parentName: '',
          parentPhone: '',
          photo: '',
          birthDate: '',
          birthPlace: '',
          address: '',
        }
      : null);

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const [mats, asns, grds] = await Promise.all([
          LmsApiService.materials(),
          LmsApiService.assignments(),
          LmsApiService.myGrades(),
        ]);
        if (cancelled) return;
        if (mats.length > 0) {
          setServerMaterials(
            mats.map((m) => ({
              id: m.id,
              subjectName: m.subject?.name ?? 'Umum',
              title: m.title,
              description: m.description ?? '',
              fileType: m.file_type,
              fileSize: '-',
              downloadUrl: m.download_url ?? '',
              uploadedAt: String(m.created_at).slice(0, 10),
              author: '',
              kelas: m.kelas ?? '',
            }))
          );
        }
        if (asns.length > 0) {
          setServerAssignments(
            asns.map((a) => ({
              id: a.id,
              subjectId: a.subject_id,
              subjectName: a.subject?.name ?? 'Umum',
              title: a.title,
              description: a.description ?? '',
              deadline: String(a.deadline).replace('T', ' ').slice(0, 16),
              teacherName: '',
              kelas: a.kelas ?? '',
              status: 'Belum Dikerjakan',
            }))
          );
        }
        if (grds.length > 0) {
          setServerGrades(
            grds.map((g) => ({
              id: g.id,
              studentId: '',
              nisn: student?.nisn ?? '',
              studentName: student?.name ?? '',
              kelas: student?.kelas ?? '',
              subjectId: g.subject?.id ?? '',
              subjectName: g.subject?.name ?? 'Umum',
              nilaiTugas: g.nilai_tugas ?? 0,
              nilaiUTS: g.nilai_uts ?? 0,
              nilaiUAS: g.nilai_uas ?? 0,
              nilaiAkhir: g.nilai_akhir ?? 0,
              predikat: (g.predikat as StudentGrade['predikat']) ?? 'C',
              catatanGuru: g.catatan_guru ?? '',
            }))
          );
        }
      } catch {
        /* offline → mock */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ringkasan server: dipanggil saat mount bila sesi login tersedia.
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    setIsSummaryLoading(true);
    void (async () => {
      try {
        const data = await LmsApiService.mySummary();
        if (cancelled) return;
        setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setIsSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayMaterials = serverMaterials ?? materials;
  const displayAssignments = (serverAssignments ?? assignments).map((a) =>
    submittedIds.has(a.id) ? { ...a, status: 'Sudah Dikumpulkan' as const } : a
  );
  const displayGrades = serverGrades ?? grades;

  // Student KTS Modal
  const [isKtsModalOpen, setIsKtsModalOpen] = useState(false);
  const [ktsQrSvg, setKtsQrSvg] = useState('');

  // QR kartu siswa dibuat saat modal KTS dibuka; encoder asinkron.
  useEffect(() => {
    if (!isKtsModalOpen || !serverStudent) {
      setKtsQrSvg('');
      return;
    }
    let cancelled = false;
    void generateSvgQrMatrix(`NISN:${serverStudent.nisn}`, 100, '#0f172a').then((svg) => {
      if (!cancelled) setKtsQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [isKtsModalOpen, serverStudent?.nisn]);

  // Filter assignments
  const studentAssignments = displayAssignments.filter((a) => !a.kelas || a.kelas === serverStudent?.kelas);
  const studentGrades = displayGrades.filter((g) => g.nisn === serverStudent?.nisn);

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    // Server-first: unggah berkas nyata bila tugas berasal dari API.
    if (serverAssignments !== null && uploadFile) {
      setIsSubmitting(true);
      try {
        await LmsApiService.submitAssignment(selectedAssignment.id, uploadFile);
        setSubmittedIds((prev) => new Set(prev).add(selectedAssignment.id));
        onShowToast('Tugas Berhasil Dikumpulkan', `Tugas "${selectedAssignment.title}" tersimpan di server LMS.`, 'success');
      } catch {
        onShowToast('Gagal Mengumpulkan', 'Tenggat lewat atau server menolak berkas.', 'error');
      } finally {
        setIsSubmitting(false);
        setSelectedAssignment(null);
        setUploadFileName('');
        setUploadFile(null);
        setUploadNotes('');
      }
      return;
    }

    if (!uploadFileName.trim()) {
      onShowToast('Berkas Belum Dipilih', 'Pilih atau tuliskan nama berkas tugas Anda.', 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const updated: Assignment = {
        ...selectedAssignment,
        status: 'Sudah Dikumpulkan',
        submittedFile: uploadFileName,
        submittedAt: '2026-09-08 07:45',
      };
      onUpdateAssignment(updated);
      onShowToast('Tugas Berhasil Dikumpulkan', `Tugas "${selectedAssignment.title}" berhasil diunggah ke server LMS.`, 'success');
      setSelectedAssignment(null);
      setUploadFileName('');
      setUploadNotes('');
    }, 800);
  };

  if (!serverStudent) {
    return (
      <EmptyState
        title="Data siswa belum tersedia"
        message={
          TokenStorage.hasSession()
            ? 'Data siswa belum bisa dimuat dari server. Coba muat ulang halaman.'
            : 'Masuk terlebih dahulu untuk melihat nilai, tugas, dan presensi Anda.'
        }
        testId="student-profile-empty-state"
      />
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6" data-testid="student-portal-module">
      {/* Top Statistical Header Bar */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={serverStudent.photo !== '' ? serverStudent.photo : initialsAvatar(serverStudent.name)}
              alt={serverStudent.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-300 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-teal-500/30 text-teal-200 border border-teal-400/40 text-[10px] font-bold font-mono">
                  NISN: {serverStudent.nisn}
                </span>
                <span className="text-xs text-teal-200/80">{serverStudent.kelas}</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{serverStudent.name}</h2>
              <p className="text-xs text-teal-100/80">{serverStudent.jurusan}</p>
            </div>
          </div>

          {/* Quick Stat Badges — server-first (GET /lms/summary/mine) */}
          <div className="flex flex-col gap-2 md:items-end" data-testid="student-header-stats">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-center">
                <p className="text-[10px] text-teal-200 uppercase font-semibold">NISN</p>
                <p className="text-sm font-black text-white font-mono">{summary?.nisn ?? serverStudent.nisn}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-center">
                <p className="text-[10px] text-teal-200 uppercase font-semibold">Kehadiran</p>
                <p className="text-lg font-black text-white">{isSummaryLoading ? '…' : formatSummaryStat(summary?.attendance_percentage, '%')}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-center">
                <p className="text-[10px] text-teal-200 uppercase font-semibold">Rata-rata Nilai</p>
                <p className="text-lg font-black text-white">{isSummaryLoading ? '…' : formatSummaryStat(summary?.average_grade)}</p>
              </div>
            </div>
            {!isSummaryLoading && !summary && (
              <p className="text-[10px] text-teal-200/80" data-testid="student-header-stats-empty">
                Ringkasan kehadiran &amp; nilai belum tersedia dari server.
              </p>
            )}
          </div>
        </div>

        {/* Action Button: Go to Online Exam CBT */}
        <div className="mt-4 pt-4 border-t border-teal-600/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-teal-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Penilaian Tengah Semester (PTS) CBT Online aktif hari ini</span>
          </p>
          <button
            onClick={onOpenCbtExam}
            className="min-h-11 px-4 py-2 bg-emerald-500 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 text-xs"
            data-testid="btn-open-cbt-room"
          >
            <Clock className="w-4 h-4" />
            <span>Masuk Ruang Ujian CBT</span>
          </button>
        </div>
      </div>

      {/* VIEW: BERANDA */}
      {activeBottomNav === 'beranda' && (
        <div className="space-y-6">
          {/* Quick Access Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => setActiveBottomNav('tugas')}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs text-left transition-all group"
            >
              <FileCheck className="w-6 h-6 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Tugas LMS</p>
              <p className="text-[11px] text-slate-500 mt-0.5">1 Tugas Menunggu</p>
            </button>

            <button
              onClick={() => setActiveBottomNav('jadwal')}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs text-left transition-all group"
            >
              <Calendar className="w-6 h-6 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Jadwal KBM</p>
              <p className="text-[11px] text-slate-500 mt-0.5">2 Mapel Hari Ini</p>
            </button>

            <button
              onClick={() => setActiveBottomNav('nilai')}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs text-left transition-all group"
            >
              <Award className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Transkrip Nilai</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Semester Ganjil</p>
            </button>

            <button
              onClick={() => setIsKtsModalOpen(true)}
              className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-teal-400 shadow-xs text-left transition-all group"
            >
              <QrCode className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">KTS Digital</p>
              <p className="text-[11px] text-slate-500 mt-0.5">QR Presensi Siswa</p>
            </button>
          </div>

          {/* Learning Materials Module */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span>Bahan Ajar & Modul Pembelajaran Terkini</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Kurikulum Merdeka</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayMaterials.map((mat) => (
                <div
                  key={mat.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold font-mono">
                        {mat.fileType}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{mat.fileSize}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{mat.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{mat.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 truncate max-w-[150px]">{mat.author}</span>
                    <button
                      onClick={() => {
                        if (mat.downloadUrl) {
                          void LmsApiService.downloadMaterial(mat.downloadUrl, `${mat.title}.pdf`)
                            .then(() => onShowToast('Unduh Materi', `Berkas ${mat.title} diunduh dari server.`, 'success'))
                            .catch(() => onShowToast('Unduh Gagal', 'Server tidak merespons.', 'error'));
                          return;
                        }
                        onShowToast('Unduh Materi', `Mengunduh berkas ${mat.title} (${mat.fileSize})`, 'info');
                      }}
                      className="text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: TUGAS */}
      {activeBottomNav === 'tugas' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              <span>Daftar Tugas & Pengumpulan Daring (Assignments)</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Kelas {serverStudent.kelas}</span>
          </div>

          <div className="space-y-3">
            {studentAssignments.map((asn) => (
              <div
                key={asn.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-teal-700">
                      {asn.subjectName}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5">{asn.title}</h4>
                  </div>
                  <Badge
                    variant={
                      asn.status === 'Sudah Dikumpulkan'
                        ? 'info'
                        : asn.status === 'Dinilai'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {asn.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{asn.description}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Tenggat: {asn.deadline}
                    </span>
                    <span>Pengampu: {asn.teacherName}</span>
                  </div>

                  {asn.status === 'Belum Dikerjakan' ? (
                    <button
                      onClick={() => setSelectedAssignment(asn)}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                      data-testid={`btn-submit-task-${asn.id}`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Kumpulkan Tugas</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 text-xs">
                      {asn.score !== undefined && (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          Nilai: {asn.score} / 100
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-500">
                        File: {asn.submittedFile}
                      </span>
                    </div>
                  )}
                </div>

                {asn.feedback && (
                  <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-teal-900">
                    <strong>Ulasan Guru:</strong> {asn.feedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: JADWAL */}
      {activeBottomNav === 'jadwal' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <span>Jadwal Pelajaran KBM Mingguan ({serverStudent.kelas})</span>
          </h3>

          <div className="space-y-2.5">
            {schedule.map((sch) => (
              <div
                key={sch.id}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-16 text-center py-1 rounded-lg bg-teal-50 border border-teal-200 font-bold text-teal-800 text-[11px] font-mono">
                    {sch.day}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{sch.subjectName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {sch.timeStart} - {sch.timeEnd} WIB • {sch.teacherName}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                  {sch.room}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: NILAI */}
      {activeBottomNav === 'nilai' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-600" />
            <span>Transkrip Nilai Akademis Siswa (Semester Ganjil)</span>
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Mata Pelajaran</th>
                  <th className="p-3.5 text-center">Tugas</th>
                  <th className="p-3.5 text-center">UTS</th>
                  <th className="p-3.5 text-center">UAS</th>
                  <th className="p-3.5 text-center">Nilai Akhir</th>
                  <th className="p-3.5 text-center">Predikat</th>
                  <th className="p-3.5">Catatan Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentGrades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-bold text-slate-900">{g.subjectName}</td>
                    <td className="p-3.5 text-center font-mono">{g.nilaiTugas}</td>
                    <td className="p-3.5 text-center font-mono">{g.nilaiUTS}</td>
                    <td className="p-3.5 text-center font-mono">{g.nilaiUAS}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-teal-700 text-sm">
                      {g.nilaiAkhir}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="w-6 h-6 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-bold inline-flex items-center justify-center text-xs">
                        {g.predikat}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 text-[11px] leading-snug">{g.catatanGuru}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: PROFIL */}
      {activeBottomNav === 'profil' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <img
                src={serverStudent.photo !== '' ? serverStudent.photo : initialsAvatar(serverStudent.name)}
                alt={serverStudent.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-500 shadow-md"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900">{serverStudent.name}</h3>
                <p className="text-xs font-mono text-teal-700 font-bold">NISN: {serverStudent.nisn}</p>
                <p className="text-xs text-slate-500 mt-0.5">{serverStudent.kelas} — {serverStudent.jurusan}</p>
              </div>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-500 font-semibold">Tempat, Tanggal Lahir</span>
              <p className="font-bold text-slate-800">{serverStudent.birthPlace || serverStudent.birthDate ? `${serverStudent.birthPlace}, ${serverStudent.birthDate}` : '—'}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-500 font-semibold">Nama Orang Tua / Wali</span>
              <p className="font-bold text-slate-800">{serverStudent.parentName || '—'}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-500 font-semibold">Alamat Rumah</span>
              <p className="font-bold text-slate-800">{serverStudent.address || '—'}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-slate-500 font-semibold">No. Telepon Orang Tua</span>
              <p className="font-mono font-bold text-slate-800">{serverStudent.parentPhone || '—'}</p>
            </div>
          </div>

          <button
            onClick={() => setIsKtsModalOpen(true)}
            className="w-full min-h-11 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Lihat Kartu Tanda Pelajar (KTS) Digital</span>
          </button>
        </div>
      )}

      {/* MOBILE-FIRST BOTTOM NAVIGATION BAR (FIXED FOR SMARTPHONES) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-4 shadow-lg sm:hidden"
        data-testid="student-bottom-nav"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => setActiveBottomNav('beranda')}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 py-1 px-2 rounded-xl transition-colors ${
              activeBottomNav === 'beranda' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Beranda</span>
          </button>

          <button
            onClick={() => setActiveBottomNav('jadwal')}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 py-1 px-2 rounded-xl transition-colors ${
              activeBottomNav === 'jadwal' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Jadwal</span>
          </button>

          <button
            onClick={() => setActiveBottomNav('tugas')}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 py-1 px-2 rounded-xl transition-colors ${
              activeBottomNav === 'tugas' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Tugas</span>
          </button>

          <button
            onClick={() => setActiveBottomNav('nilai')}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 py-1 px-2 rounded-xl transition-colors ${
              activeBottomNav === 'nilai' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Nilai</span>
          </button>

          <button
            onClick={() => setActiveBottomNav('profil')}
            className={`flex flex-col items-center justify-center min-h-11 min-w-11 py-1 px-2 rounded-xl transition-colors ${
              activeBottomNav === 'profil' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Profil</span>
          </button>
        </div>
      </nav>

      {/* Assignment Submission Modal */}
      {selectedAssignment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAssignment(null)}
          title={`Pengumpulan Tugas: ${selectedAssignment.title}`}
          subtitle={`${selectedAssignment.subjectName} — Tenggat: ${selectedAssignment.deadline}`}
          maxWidth="md"
          dataTestId="assignment-submit-modal"
        >
          <form onSubmit={(e) => void handleAssignmentSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {serverAssignments !== null ? 'Berkas Tugas (PDF/DOC/ZIP/JPG, maks 10MB)' : 'Nama Berkas Tugas (ZIP, PDF, DOCX)'}
              </label>
              {serverAssignments !== null ? (
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.zip,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    setUploadFileName(f?.name ?? '');
                  }}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                  data-testid="input-task-file"
                />
              ) : (
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  required
                  placeholder="Contoh: tugas_web_ahmad_fauzi.zip"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan / Tautan Proyek GitHub (Opsional)
              </label>
              <textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Tuliskan catatan untuk guru atau lampirkan URL repositori..."
                rows={3}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Mengunggah...' : 'Kirim Tugas'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Student KTS Modal */}
      <Modal
        isOpen={isKtsModalOpen}
        onClose={() => setIsKtsModalOpen(false)}
        title={`KTS Digital: ${serverStudent.name}`}
        subtitle={`NISN: ${serverStudent.nisn}`}
        maxWidth="md"
        dataTestId="student-kts-view-modal"
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
                src={serverStudent.photo !== '' ? serverStudent.photo : initialsAvatar(serverStudent.name)}
                alt={serverStudent.name}
                className="w-16 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 text-xs space-y-0.5">
                <p className="font-bold text-slate-900">{serverStudent.name}</p>
                <p className="font-mono text-teal-700 font-bold text-[11px]">{serverStudent.nisn}</p>
                <p className="text-slate-600 text-[11px]">{serverStudent.kelas} — {serverStudent.jurusan}</p>
              </div>
              <div
                className="w-16 h-16 p-1 rounded-lg border border-slate-200 bg-white shrink-0"
                dangerouslySetInnerHTML={{ __html: ktsQrSvg }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsKtsModalOpen(false)}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Tutup
          </button>
        </div>
      </Modal>
    </div>
  );
};
