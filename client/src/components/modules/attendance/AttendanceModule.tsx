import React, { useEffect, useState } from 'react';
import { AttendanceRecord, Student, AttendanceStatus } from '../../../types';
import {
  QrCode,
  Camera,
  Barcode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Filter,
  Calendar,
  Search,
  MessageSquare,
  Users,
  Smartphone,
  Eye,
  Check,
  UserCheck,
  Download,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { generateSvgQrMatrix, addAuditLog, todayIso } from '../../../utils/helpers';
import {
  AttendanceService as AttendanceApiService,
  StudentService,
} from '../../../services/DomainService';
import { KtsApiService } from '../../../services/OpsApiService';
import { TokenStorage } from '../../../services/TokenStorage';

/** Status values accepted by `POST /attendance/manual` (lowercase server vocabulary). */
type ManualStatusValue = 'hadir' | 'terlambat' | 'sakit' | 'izin' | 'alpa';

interface ApiErrorInfo {
  status?: number;
  code?: string;
  message?: string;
}

/** Baca galat axios (respons bersarang) lewat penyempitan tipe, tanpa assertion inline. */
function readApiError(err: unknown): ApiErrorInfo {
  if (typeof err !== 'object' || err === null || !('response' in err)) return {};
  const response = err.response;
  if (typeof response !== 'object' || response === null) return {};

  const info: ApiErrorInfo = {};
  if ('status' in response && typeof response.status === 'number') info.status = response.status;
  if ('data' in response && typeof response.data === 'object' && response.data !== null) {
    const data = response.data;
    if ('message' in data && typeof data.message === 'string') info.message = data.message;
    if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
      const errors = data.errors;
      if ('code' in errors && typeof errors.code === 'string') info.code = errors.code;
    }
  }
  return info;
}

interface AttendanceModuleProps {
  records: AttendanceRecord[];
  students: Student[];
  onAddRecord: (record: AttendanceRecord) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  records,
  students,
  onAddRecord,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'scanner' | 'manual' | 'rekap'>('scanner');
  const [scanMethod, setScanMethod] = useState<'camera' | 'barcode'>('camera');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [filterDate, setFilterDate] = useState<string>(todayIso());
  const [searchQuery, setSearchQuery] = useState('');

  // Student QR Pop-up Modal State
  const [qrModalStudent, setQrModalStudent] = useState<Student | null>(null);
  const [qrSvg, setQrSvg] = useState('');

  useEffect(() => {
    if (!qrModalStudent) {
      setQrSvg('');
      return;
    }
    let cancelled = false;
    const renderLocal = () =>
      generateSvgQrMatrix(`NISN:${qrModalStudent.nisn}`, 180, '#0f172a').then((svg) => {
        if (!cancelled) setQrSvg(svg);
      });
    setQrSvg('');

    // Server-first: QR vektor bertanda tangan (SVG). Fallback ke matriks lokal saat offline.
    if (TokenStorage.hasSession()) {
      void fetch(KtsApiService.qrUrl(qrModalStudent.id), { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('qr-unavailable');
          return res.text();
        })
        .then((svg) => {
          if (!cancelled && svg) setQrSvg(svg);
          else if (!cancelled) void renderLocal();
        })
        .catch(() => {
          if (!cancelled) void renderLocal();
        });
    } else {
      void renderLocal();
    }
    return () => {
      cancelled = true;
    };
  }, [qrModalStudent]);

  // Manual attendance entry modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState(students[0]?.id || '');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Izin');
  const [manualNotes, setManualNotes] = useState('');

  // Manual entry tab (server-first: POST /attendance/manual)
  const [studentOptions, setStudentOptions] = useState<Student[]>(students);
  const [manualNisn, setManualNisn] = useState(students[0]?.nisn || '');
  const [manualDate, setManualDate] = useState(filterDate);
  const [manualTabStatus, setManualTabStatus] = useState<ManualStatusValue>('sakit');
  const [manualReason, setManualReason] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Rekap tab: rentang laporan server
  const [rekapTo, setRekapTo] = useState(new Date().toISOString().slice(0, 10));
  const [rekapRecords, setRekapRecords] = useState<AttendanceRecord[] | null>(null);
  const [rekapLoading, setRekapLoading] = useState(false);

  // Katalog siswa: dari server bila ada sesi. Produksi menggantungkan resolusi
  // scan pada daftar ini karena prop `students` (mock) kosong di bundle produksi;
  // cache aplikasi hanya fallback offline/DEV.
  useEffect(() => {
    if (!TokenStorage.hasSession()) {
      if (students.length > 0) setStudentOptions(students);
      return;
    }
    let cancelled = false;
    void StudentService.list()
      .then((list) => {
        if (!cancelled) setStudentOptions(list.length > 0 ? list : students);
      })
      .catch(() => {
        if (!cancelled && students.length > 0) setStudentOptions(students);
      });
    return () => {
      cancelled = true;
    };
  }, [students]);

  useEffect(() => {
    if (studentOptions.length === 0) return;
    setManualNisn((prev) => (studentOptions.some((s) => s.nisn === prev) ? prev : studentOptions[0].nisn));
  }, [studentOptions]);

  /** Roster aktif: katalog server bila termuat, selain itu cache/mock DEV. */
  const roster = studentOptions.length > 0 ? studentOptions : students;
  const findStudentByNisn = (nisn: string): Student | undefined => roster.find((s) => s.nisn === nisn);
  const findStudentById = (id: string): Student | undefined => roster.find((s) => s.id === id);

  // Rekap: ambil laporan rentang tanggal dari server saat tab/rentang berubah.
  useEffect(() => {
    if (activeSubTab !== 'rekap') return;
    if (!TokenStorage.hasSession()) {
      setRekapRecords(null);
      return;
    }
    let cancelled = false;
    setRekapLoading(true);
    void AttendanceApiService.reports(filterDate, rekapTo, students)
      .then((rows) => {
        if (!cancelled) setRekapRecords(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setRekapRecords([]);
          onShowToast('Gagal Memuat Rekap', 'Server tidak merespons permintaan laporan presensi.', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setRekapLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, filterDate, rekapTo]);

  // Handle Scanning Simulation
  const handleScanNisn = async (nisn: string) => {
    const scanDate = todayIso();
    const student = findStudentByNisn(nisn);

    // Tanpa sesi (DEV) katalog lokal wajib ada. Dengan sesi, server yang jadi
    // sumber kebenaran — roster halaman ini hanya 25 baris pertama, siswa lain
    // tetap boleh discan dan divalidasi server.
    if (!student && !TokenStorage.hasSession()) {
      onShowToast('NISN Tidak Dikenali', `Data siswa dengan NISN ${nisn} tidak ditemukan pada database.`, 'error');
      return;
    }

    // Duplikat dari cache lokal (server tetap otoritas akhir via 409).
    const existing = student ? records.find((r) => r.nisn === nisn && r.date === scanDate) : undefined;
    if (existing && student) {
      onShowToast('Peringatan Presensi', `${student.name} sudah melakukan presensi hari ini (${existing.status} pada ${existing.timeIn}).`, 'warning');
      return;
    }

    // Server-first: catat via API (klasifikasi jam server + anti-duplikat + notifikasi WA).
    // Tanggal scan = hari ini di server (permintaan bertanggal lain ditolak 422).
    if (TokenStorage.hasSession()) {
      try {
        const rec = await AttendanceApiService.scan(nisn, scanDate, students);
        onAddRecord(rec);
        addAuditLog('ATTENDANCE_SCAN', `Presensi ${rec.status}: ${rec.studentName} (${rec.nisn}) jam ${rec.timeIn} (server)`, 'Operator Gerbang', 'operator');
        onShowToast(
          'Presensi Berhasil Dicatat',
          `${rec.studentName} (${rec.status}). Notifikasi WhatsApp otomatis terkirim ke Orang Tua.`,
          rec.status === 'Terlambat' ? 'warning' : 'success'
        );
        setBarcodeInput('');
        return;
      } catch (err) {
        const info = readApiError(err);
        if (info.status === 409 || info.code === 'CONFLICT') {
          onShowToast('Peringatan Presensi', `${student?.name ?? nisn} sudah tercatat hari ini (server).`, 'warning');
          return;
        }
        if (info.status === 404 || info.code === 'NOT_FOUND') {
          onShowToast('NISN Tidak Dikenali', `Data siswa dengan NISN ${nisn} tidak ditemukan di server.`, 'error');
          return;
        }
        if (!import.meta.env.DEV) {
          onShowToast('Gagal Mencatat', info.code ?? 'Server tidak merespons.', 'error');
          return;
        }
        // DEV: lanjut simulasi lokal agar bisa didemo tanpa API.
      }
    }

    // Simulasi lokal (DEV tanpa API) hanya masuk akal bila siswa ada di katalog.
    if (!student) return;

    // Determine Hadir vs Terlambat based on current simulated hour
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeIn = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    // School entry threshold: 07:00 WIB
    const isLate = now.getHours() > 7 || (now.getHours() === 7 && now.getMinutes() > 0);
    const minutesLate = isLate ? (now.getHours() - 7) * 60 + now.getMinutes() : 0;
    const status: AttendanceStatus = isLate ? 'Terlambat' : 'Hadir';

    const newRecord: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      studentId: student.id,
      nisn: student.nisn,
      studentName: student.name,
      kelas: student.kelas,
      date: scanDate,
      timeIn,
      status,
      minutesLate: isLate ? minutesLate : undefined,
      notes: isLate ? `Terlambat ${minutesLate} menit` : 'Tepat waktu via Scanner Gerbang',
    };

    onAddRecord(newRecord);
    addAuditLog('ATTENDANCE_SCAN', `Presensi ${status}: ${student.name} (${student.nisn}) jam ${timeIn}`, 'Operator Gerbang', 'operator');

    // Trigger WhatsApp notification simulator
    onShowToast(
      'Presensi Berhasil Dicatat',
      `${student.name} (${status}). Notifikasi WhatsApp otomatis terkirim ke Orang Tua (${student.parentPhone})`,
      isLate ? 'warning' : 'success'
    );

    setBarcodeInput('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const student = findStudentById(manualStudentId);
    if (!student) return;

    const newRecord: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      studentId: student.id,
      nisn: student.nisn,
      studentName: student.name,
      kelas: student.kelas,
      date: filterDate,
      timeIn: manualStatus === 'Hadir' || manualStatus === 'Terlambat' ? '07:30' : '-',
      status: manualStatus,
      notes: manualNotes || `Entri manual oleh Operator: ${manualStatus}`,
    };

    onAddRecord(newRecord);
    addAuditLog('ATTENDANCE_MANUAL', `Input manual presensi ${manualStatus} untuk ${student.name}`, 'Operator', 'operator');
    onShowToast('Presensi Disimpan', `Status ${student.name} diperbarui menjadi ${manualStatus}.`, 'success');
    setManualModalOpen(false);
    setManualNotes('');
  };

  // Entri manual via tab: server-first (POST /attendance/manual) — wajib alasan, anti-duplikat.
  const handleManualTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNisn) {
      onShowToast('Data Belum Lengkap', 'Pilih siswa terlebih dahulu.', 'warning');
      return;
    }
    if (!manualReason.trim()) {
      onShowToast('Alasan Wajib', 'Alasan entri manual tidak boleh kosong.', 'warning');
      return;
    }
    if (!TokenStorage.hasSession()) {
      onShowToast('Mode Lokal', 'Entri manual butuh koneksi ke server.', 'error');
      return;
    }

    setManualSubmitting(true);
    try {
      const rec = await AttendanceApiService.manual(
        manualNisn,
        manualDate,
        manualTabStatus,
        manualReason.trim(),
        studentOptions
      );
      onAddRecord(rec);
      addAuditLog('ATTENDANCE_MANUAL', `Input manual presensi ${rec.status} untuk ${rec.studentName}`, 'Operator', 'operator');
      onShowToast('Presensi Disimpan', `Status ${rec.studentName} dicatat sebagai ${rec.status}.`, 'success');
      setManualReason('');
    } catch (err) {
      const info = readApiError(err);
      if (info.status === 409 || info.code === 'CONFLICT') {
        onShowToast('Presensi Ganda', 'Siswa sudah tercatat pada tanggal tersebut.', 'warning');
      } else {
        onShowToast('Gagal Menyimpan', info.message ?? info.code ?? 'Server tidak merespons.', 'error');
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // Filtered attendance records
  const filteredRecords = records.filter((rec) => {
    const matchesDate = rec.date === filterDate;
    const matchesClass = selectedClass === 'Semua' || rec.kelas === selectedClass;
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.nisn.includes(searchQuery);
    return matchesDate && matchesClass && matchesSearch;
  });

  // Rekap: baris server bila tersedia (sudah tersaring rentang), jika tidak pakai cache lokal.
  const baseRekapRows = rekapRecords ?? records;
  const rekapRows = baseRekapRows.filter((rec) => {
    const matchesRange = rekapRecords ? true : rec.date >= filterDate && rec.date <= rekapTo;
    const matchesClass = selectedClass === 'Semua' || rec.kelas === selectedClass;
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.nisn.includes(searchQuery);
    return matchesRange && matchesClass && matchesSearch;
  });

  // Calculate statistics
  const totalScanned = filteredRecords.length;
  const hadirCount = filteredRecords.filter((r) => r.status === 'Hadir').length;
  const terlambatCount = filteredRecords.filter((r) => r.status === 'Terlambat').length;
  const sakitIzinCount = filteredRecords.filter((r) => r.status === 'Sakit' || r.status === 'Izin').length;
  const alpaCount = filteredRecords.filter((r) => r.status === 'Alpa').length;

  return (
    <div className="space-y-6" data-testid="attendance-module">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-teal-600" />
            <span>Presensi Harian & Pemindaian QR Code Instant</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mendukung pemindaian kamera HP/Laptop dan Barcode Scanner USB dengan klasifikasi status otomatis
          </p>
          <p className="mt-1.5">
            {TokenStorage.hasSession() ? (
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono" data-testid="attendance-live-badge">
                LIVE API — tersambung server
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono">
                MODE LOKAL — login untuk sinkron server
              </span>
            )}
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('scanner')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'scanner'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-sub-scanner"
          >
            Pemindai Kamera / Barcode
          </button>
          <button
            onClick={() => setActiveSubTab('manual')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'manual'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-attendance-manual"
          >
            Entri Manual
          </button>
          <button
            onClick={() => setActiveSubTab('rekap')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'rekap'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-sub-rekap"
          >
            Laporan & Rekapitulasi
          </button>
        </div>
      </div>

      {/* VIEW 1: SCANNER VIEW */}
      {activeSubTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scanner Viewfinder Box */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Live Viewfinder Pemindai</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-semibold text-emerald-700">Kamera Siap</span>
              </div>
            </div>

            {/* Viewfinder Frame with Laser Sweep */}
            <div className="w-full max-w-sm aspect-square bg-slate-950 rounded-2xl relative overflow-hidden border-2 border-slate-700 flex flex-col items-center justify-center p-6 shadow-inner">
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-teal-400 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-teal-400 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-teal-400 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-teal-400 rounded-br-lg" />

              {/* Laser sweep animation line */}
              <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_12px_#2dd4bf] animate-laser pointer-events-none" />

              {/* Target Aim Icon */}
              <div className="w-36 h-36 border border-teal-500/30 rounded-2xl flex flex-col items-center justify-center text-teal-400/80 p-3 text-center space-y-2">
                <QrCode className="w-12 h-12 opacity-80" />
                <p className="text-[10px] text-teal-300/90 font-mono">
                  Arahkan QR Code KTS Siswa ke area ini
                </p>
              </div>

              {/* Status bar inside camera */}
              <div className="absolute bottom-3 text-[10px] font-mono text-slate-500 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                Pintu Masuk Gerbang Utama (60 FPS)
              </div>
            </div>

            {/* Quick Test Click Simulation for Available Students */}
            <div className="w-full space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Simulasi Pemindaian Cepat (Klik Siswa di Bawah):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {roster.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleScanNisn(s.nisn)}
                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-left transition-colors group"
                    data-testid={`simulate-scan-${s.nisn}`}
                  >
                    <p className="text-xs font-bold text-slate-800 group-hover:text-teal-900 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">{s.nisn}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Barcode / NISN Input */}
            <div className="w-full pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-slate-600" />
                <span>Input Barcode Scanner USB / Ketik NISN Manual:</span>
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (barcodeInput.trim()) handleScanNisn(barcodeInput.trim());
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode atau ketik 10 digit NISN..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                  data-testid="input-barcode-scanner"
                />
                <button
                  type="submit"
                  className="min-h-11 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  data-testid="btn-submit-barcode"
                >
                  Proses
                </button>
              </form>
            </div>
          </div>

          {/* Real-time Activity Log on Scanner */}
          <div className="lg:col-span-6 space-y-6">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-[11px] font-semibold text-slate-500">Total Scan Hari Ini</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalScanned}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
                <p className="text-[11px] font-semibold text-emerald-700">Tepat Waktu</p>
                <p className="text-2xl font-black text-emerald-800 mt-1">{hadirCount}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
                <p className="text-[11px] font-semibold text-amber-700">Terlambat</p>
                <p className="text-2xl font-black text-amber-800 mt-1">{terlambatCount}</p>
              </div>
            </div>

            {/* Live Scanned Students Feed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Riwayat Pemindaian Real-Time ({filterDate})</span>
                </span>
                <button
                  onClick={() => setManualModalOpen(true)}
                  className="text-xs text-teal-600 hover:underline font-semibold"
                  data-testid="btn-open-manual-attendance"
                >
                  + Entri Manual
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {records.slice(0, 6).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 font-mono shrink-0">
                        {rec.timeIn}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{rec.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {rec.nisn} — {rec.kelas}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                      <button
                        onClick={() => {
                          const s = roster.find((item) => item.nisn === rec.nisn);
                          if (s) setQrModalStudent(s);
                        }}
                        className="p-1 text-slate-500 hover:text-teal-600 rounded-md"
                        title="Lihat QR Code Siswa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daftar QR Siswa — pratinjau QR vektor per siswa */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-teal-600" />
                <span>QR Code Presensi Siswa</span>
              </span>
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {studentOptions.length === 0 && (
                  <p className="text-xs text-slate-500 py-3 text-center" data-testid="student-qr-empty">
                    Belum ada data siswa untuk ditampilkan.
                  </p>
                )}
                {studentOptions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{s.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {s.nisn} — {s.kelas}
                      </p>
                    </div>
                    <button
                      onClick={() => setQrModalStudent(s)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 text-slate-600 hover:text-teal-700 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                      data-testid={`btn-show-qr-${s.nisn.slice(0, 8)}`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Lihat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ENTRY MANUAL */}
      {activeSubTab === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span>Entri Presensi Manual</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Fallback saat QR Code tidak terbaca. Server menolak duplikat dan menulis jejak audit.
              </p>
            </div>

            <form onSubmit={handleManualTabSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Siswa</label>
                <select
                  value={manualNisn}
                  onChange={(e) => setManualNisn(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
                  data-testid="input-manual-nisn"
                >
                  {studentOptions.length === 0 && <option value="">Belum ada data siswa</option>}
                  {studentOptions.map((s) => (
                    <option key={s.id} value={s.nisn}>
                      {s.name} ({s.nisn} - {s.kelas})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
                    data-testid="input-manual-date"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status Kehadiran</label>
                  <select
                    value={manualTabStatus}
                    onChange={(e) => setManualTabStatus(e.target.value as ManualStatusValue)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
                    data-testid="input-manual-status"
                  >
                    <option value="hadir">Hadir</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="sakit">Sakit</option>
                    <option value="izin">Izin</option>
                    <option value="alpa">Alpa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alasan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Contoh: Siswa mewakili sekolah pada lomba olimpiade sains"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  data-testid="input-manual-reason"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Alasan wajib diisi dan tersimpan pada audit log (FRD §7.2).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('scanner')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="min-h-11 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="btn-submit-manual"
                >
                  {manualSubmitting ? 'Menyimpan...' : 'Simpan Entri Manual'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Panduan Status Kehadiran</span>
            </h3>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <Badge variant="success">Hadir</Badge>
                <span>Dicatat saat surat/dokumen keterlambatan tidak diperlukan.</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="warning">Terlambat</Badge>
                <span>Siswa datang setelah batas jam masuk sekolah.</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="info">Sakit</Badge>
                <span>Wajib melampirkan surat keterangan dokter pada arsip wali kelas.</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="neutral">Izin</Badge>
                <span>Keperluan keluarga dengan surat permohonan orang tua.</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="neutral">Alpa</Badge>
                <span>Tanpa keterangan; memicu notifikasi WhatsApp ke orang tua.</span>
              </li>
            </ul>
            <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-3">
              Satu siswa hanya dapat tercatat sekali per tanggal. Entri ganda ditolak server (409).
            </p>
          </div>
        </div>
      )}

      {/* VIEW 3: REKAPITULASI & LAPORAN */}
      {activeSubTab === 'rekap' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  data-testid="input-filter-date"
                  aria-label="Tanggal mulai rekap"
                />
                <span className="text-xs text-slate-400 font-semibold">s/d</span>
                <input
                  type="date"
                  value={rekapTo}
                  onChange={(e) => setRekapTo(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  data-testid="input-rekap-to"
                  aria-label="Tanggal akhir rekap"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  data-testid="select-filter-class"
                >
                  <option value="Semua">Semua Kelas</option>
                  <option value="X RPL 1">X RPL 1</option>
                  <option value="XI TKJ 1">XI TKJ 1</option>
                  <option value="XII DKV 1">XII DKV 1</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa atau NISN..."
                className="pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="input-search-rekap"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!TokenStorage.hasSession()) {
                  onShowToast('Ekspor CSV', 'Mode offline — ekspor butuh koneksi ke server.', 'error');
                  return;
                }
                // Rentang: dari tanggal filter sampai tanggal akhir rekap (maks 92 hari di server).
                void AttendanceApiService.exportCsv(filterDate, rekapTo)
                  .then(() => onShowToast('Ekspor Selesai', 'Berkas CSV presensi diunduh.', 'success'))
                  .catch(() => onShowToast('Ekspor Gagal', 'Server menolak ekspor (cek rentang tanggal).', 'error'));
              }}
              className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1.5"
              data-testid="btn-export-csv"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">NISN</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5">Kelas</th>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Jam Masuk</th>
                  <th className="p-3.5">Status Presensi</th>
                  <th className="p-3.5">Keterangan / Keterlambatan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rekapLoading && (
                  <tr data-testid="rekap-loading">
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      Memuat data rekap dari server...
                    </td>
                  </tr>
                )}
                {!rekapLoading && rekapRows.length === 0 && (
                  <tr data-testid="rekap-empty-state">
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      Tidak ada catatan presensi pada rentang {filterDate} s/d {rekapTo}.
                    </td>
                  </tr>
                )}
                {!rekapLoading && rekapRows.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono text-slate-600 font-semibold">{rec.nisn}</td>
                    <td className="p-3.5 font-bold text-slate-900">{rec.studentName}</td>
                    <td className="p-3.5 text-slate-600">{rec.kelas}</td>
                    <td className="p-3.5 font-mono text-slate-600">{rec.date}</td>
                    <td className="p-3.5 font-mono font-semibold text-slate-700">{rec.timeIn}</td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          rec.status === 'Hadir'
                            ? 'success'
                            : rec.status === 'Terlambat'
                            ? 'warning'
                            : rec.status === 'Sakit'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {rec.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-slate-500">{rec.notes || '-'}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          const s = roster.find((item) => item.nisn === rec.nisn);
                          if (s) setQrModalStudent(s);
                        }}
                        className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Tampilkan QR Code Siswa"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student QR Pop-up Modal */}
      {qrModalStudent && (
        <Modal
          isOpen={true}
          onClose={() => setQrModalStudent(null)}
          title={`QR Code Presensi: ${qrModalStudent.name}`}
          subtitle={`NISN: ${qrModalStudent.nisn} — Kelas: ${qrModalStudent.kelas}`}
          maxWidth="sm"
          dataTestId="student-qr-modal"
        >
          <div className="flex flex-col items-center justify-center p-4 space-y-4" data-testid="modal-student-qr">
            <div className="w-52 h-52 p-4 rounded-2xl border border-slate-200 bg-white shadow-md flex items-center justify-center">
              {qrSvg ? (
                <div
                  className="w-full h-full flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <p className="text-xs text-slate-400" data-testid="student-qr-loading">
                  Memuat QR Code...
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="font-mono font-bold text-slate-900 text-sm">{qrModalStudent.nisn}</p>
              <p className="text-xs text-slate-500 mt-0.5">{qrModalStudent.name}</p>
              <p className="text-[11px] text-teal-600 font-semibold mt-1">
                Tunjukkan QR Code ini ke kamera scanner sekolah
              </p>
            </div>
            <button
              onClick={() => setQrModalStudent(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}

      {/* Manual Attendance Entry Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Entri Presensi Manual"
        subtitle="Pencatatan status kehadiran oleh Operator atau Guru Piket"
        maxWidth="md"
        dataTestId="manual-attendance-modal"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Siswa</label>
            <select
              value={manualStudentId}
              onChange={(e) => setManualStudentId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.nisn} - {s.kelas})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status Kehadiran</label>
            <select
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value as AttendanceStatus)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
            >
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Sakit">Sakit (Surat Dokter)</option>
              <option value="Izin">Izin (Surat Orang Tua)</option>
              <option value="Alpa">Alpa / Tanpa Keterangan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Catatan Tambahan</label>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Contoh: Mengikuti lomba olimpiade sains mewakili sekolah"
              rows={3}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setManualModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              Simpan Presensi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
