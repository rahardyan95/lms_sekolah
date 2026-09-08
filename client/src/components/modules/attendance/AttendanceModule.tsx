import React, { useState } from 'react';
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
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { generateSvgQrMatrix, addAuditLog } from '../../../utils/helpers';

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
  const [activeSubTab, setActiveSubTab] = useState<'scanner' | 'rekap'>('scanner');
  const [scanMethod, setScanMethod] = useState<'camera' | 'barcode'>('camera');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [filterDate, setFilterDate] = useState<string>('2026-09-08');
  const [searchQuery, setSearchQuery] = useState('');

  // Student QR Pop-up Modal State
  const [qrModalStudent, setQrModalStudent] = useState<Student | null>(null);

  // Manual attendance entry modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState(students[0]?.id || '');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('Izin');
  const [manualNotes, setManualNotes] = useState('');

  // Handle Scanning Simulation
  const handleScanNisn = (nisn: string) => {
    const student = students.find((s) => s.nisn === nisn);
    if (!student) {
      onShowToast('NISN Tidak Dikenali', `Data siswa dengan NISN ${nisn} tidak ditemukan pada database.`, 'error');
      return;
    }

    // Check if already checked in today
    const existing = records.find((r) => r.nisn === nisn && r.date === filterDate);
    if (existing) {
      onShowToast('Peringatan Presensi', `${student.name} sudah melakukan presensi hari ini (${existing.status} pada ${existing.timeIn}).`, 'warning');
      return;
    }

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
      date: filterDate,
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
    const student = students.find((s) => s.id === manualStudentId);
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

  // Filtered attendance records
  const filteredRecords = records.filter((rec) => {
    const matchesDate = rec.date === filterDate;
    const matchesClass = selectedClass === 'Semua' || rec.kelas === selectedClass;
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.nisn.includes(searchQuery);
    return matchesDate && matchesClass && matchesSearch;
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
              <div className="absolute bottom-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                Pintu Masuk Gerbang Utama (60 FPS)
              </div>
            </div>

            {/* Quick Test Click Simulation for Available Students */}
            <div className="w-full space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Simulasi Pemindaian Cepat (Klik Siswa di Bawah):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {students.slice(0, 3).map((s) => (
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
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
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
                          const s = students.find((item) => item.nisn === rec.nisn);
                          if (s) setQrModalStudent(s);
                        }}
                        className="p-1 text-slate-400 hover:text-teal-600 rounded-md"
                        title="Lihat QR Code Siswa"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: REKAPITULASI & LAPORAN */}
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
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa atau NISN..."
                className="pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="input-search-rekap"
              />
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">NISN</th>
                  <th className="p-3.5">Nama Siswa</th>
                  <th className="p-3.5">Kelas</th>
                  <th className="p-3.5">Jam Masuk</th>
                  <th className="p-3.5">Status Presensi</th>
                  <th className="p-3.5">Keterangan / Keterlambatan</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono text-slate-600 font-semibold">{rec.nisn}</td>
                    <td className="p-3.5 font-bold text-slate-900">{rec.studentName}</td>
                    <td className="p-3.5 text-slate-600">{rec.kelas}</td>
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
                          const s = students.find((item) => item.nisn === rec.nisn);
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
          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            <div
              className="w-52 h-52 p-4 rounded-2xl border border-slate-200 bg-white shadow-md flex items-center justify-center"
              dangerouslySetInnerHTML={{
                __html: generateSvgQrMatrix(`NISN:${qrModalStudent.nisn}`, 180, '#0f172a'),
              }}
            />
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
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              Simpan Presensi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
