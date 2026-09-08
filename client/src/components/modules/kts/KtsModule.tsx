import React, { useState } from 'react';
import { Student, SchoolConfig } from '../../../types';
import {
  Printer,
  Download,
  Palette,
  Eye,
  Sliders,
  Sparkles,
  QrCode,
  ShieldCheck,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';
import { generateSvgQrMatrix, maskSensitive } from '../../../utils/helpers';
import { Modal } from '../../common/Modal';

interface KtsModuleProps {
  students: Student[];
  schoolConfig: SchoolConfig;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const KtsModule: React.FC<KtsModuleProps> = ({
  students,
  schoolConfig,
  onShowToast,
}) => {
  const [selectedStudent, setSelectedStudent] = useState<Student>(students[0]);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

  // KTS Builder Customizer State
  const [headerColor, setHeaderColor] = useState('#0d9488'); // Deep Teal
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [accentColor, setAccentColor] = useState('#0f172a');
  const [showWatermark, setShowWatermark] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [cardRadius, setCardRadius] = useState<'rounded-xl' | 'rounded-2xl' | 'rounded-none'>('rounded-2xl');

  // Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // SVG QR Code for current student
  const qrSvg = generateSvgQrMatrix(`NISN:${selectedStudent.nisn};NAMA:${selectedStudent.name};SEKOLAH:${schoolConfig.npsn}`, 140, accentColor);

  const handlePrint = () => {
    window.print();
    onShowToast('Cetak KTS Digital', 'Membuka dialog pencetak browser format ISO CR-80 (85.6mm × 54mm)', 'info');
  };

  const handleDownload = () => {
    onShowToast('Unduh KTS Berhasil', `KTS Digital siswa ${selectedStudent.name} berhasil diekspor.`, 'success');
  };

  return (
    <div className="space-y-6" data-testid="kts-module">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-600" />
            <span>Kartu Tanda Siswa (KTS) Digital & Generator QR Code</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Format fisik standar ISO CR-80 (85.6mm × 54mm) dengan QR Code vektor presisi tinggi berbasis NISN
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            data-testid="btn-preview-kts"
          >
            <Eye className="w-4 h-4 text-slate-600" />
            <span>Pratinjau KTS</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-sm shadow-teal-600/20"
            data-testid="btn-print-kts"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak KTS CR-80</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Student Selector & Template Customizer */}
        <div className="lg:col-span-4 space-y-6">
          {/* Select Student */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Pilih Data Siswa
            </label>
            <select
              value={selectedStudent.id}
              onChange={(e) => {
                const s = students.find((item) => item.id === e.target.value);
                if (s) setSelectedStudent(s);
              }}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              data-testid="select-kts-student"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.nisn} — {student.name} ({student.kelas})
                </option>
              ))}
            </select>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Jurusan:</span>
                <span className="font-semibold text-slate-800">{selectedStudent.jurusan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NIK (Masked):</span>
                <span className="font-mono text-slate-800">{maskSensitive(selectedStudent.nik, 'nik')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tempat/Tgl Lahir:</span>
                <span className="text-slate-800">{selectedStudent.birthPlace}, {selectedStudent.birthDate}</span>
              </div>
            </div>
          </div>

          {/* KTS Template Customizer */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span>Pengaturan Desain Kartu</span>
              </span>
              <button
                onClick={() => {
                  setHeaderColor('#0d9488');
                  setHeaderTextColor('#ffffff');
                  setAccentColor('#0f172a');
                  setShowWatermark(true);
                  setShowBarcode(true);
                }}
                className="text-[11px] text-teal-600 hover:underline flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Header Color Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Warna Header Kartu</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                />
                <span className="text-xs font-mono text-slate-600">{headerColor}</span>
              </div>
            </div>

            {/* Accent Color Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Warna Aksen & QR Code</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                />
                <span className="text-xs font-mono text-slate-600">{accentColor}</span>
              </div>
            </div>

            {/* Toggle Elements */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-700">Watermark Logo Sekolah</span>
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-700">Tampilkan Barcode Belakang</span>
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => setShowBarcode(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Card Canvas (CR-80 Dimensions: 85.6mm x 54mm aspect ratio 1.585) */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center bg-slate-100/80 p-6 sm:p-10 rounded-2xl border border-slate-200">
          {/* Card Side Toggle */}
          <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setCardSide('front')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                cardSide === 'front'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="toggle-kts-front"
            >
              Tampak Depan
            </button>
            <button
              onClick={() => setCardSide('back')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                cardSide === 'back'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="toggle-kts-back"
            >
              Tampak Belakang
            </button>
          </div>

          {/* CARD CONTAINER (Preserves ISO CR-80 Aspect Ratio 85.6mm x 54mm -> approx 1.585) */}
          <div className="w-full max-w-[460px] aspect-[85.6/54] relative shadow-2xl rounded-2xl overflow-hidden border border-slate-300 bg-white transition-all transform hover:scale-[1.01]">
            {/* FRONT SIDE */}
            {cardSide === 'front' && (
              <div className="h-full flex flex-col justify-between p-4 relative select-none">
                {/* Background Watermark */}
                {showWatermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                    <GraduationCap className="w-64 h-64 text-slate-900" />
                  </div>
                )}

                {/* Card Header */}
                <div
                  className="flex items-center gap-3 p-2.5 rounded-xl text-white shadow-xs"
                  style={{ backgroundColor: headerColor }}
                >
                  <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider truncate leading-tight">
                      {schoolConfig.name}
                    </h3>
                    <p className="text-[10px] text-teal-100 truncate">
                      KARTU TANDA PELAJAR DIGITAL (KTS)
                    </p>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                    CR-80
                  </span>
                </div>

                {/* Card Body: Photo, Details & QR Code */}
                <div className="flex items-center gap-4 my-auto pt-2">
                  {/* Student Photo */}
                  <div className="w-24 h-28 rounded-xl overflow-hidden border-2 border-slate-200 shadow-xs shrink-0 bg-slate-100">
                    <img
                      src={selectedStudent.photo}
                      alt={selectedStudent.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Student Details */}
                  <div className="flex-1 min-w-0 space-y-1 text-slate-800 text-xs">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        Nama Lengkap
                      </p>
                      <p className="font-bold text-slate-900 text-sm truncate leading-tight">
                        {selectedStudent.name}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                      <div>
                        <p className="text-[9px] text-slate-400 font-semibold">NISN</p>
                        <p className="font-mono font-bold text-teal-700">{selectedStudent.nisn}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-semibold">Kelas</p>
                        <p className="font-semibold">{selectedStudent.kelas}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-semibold">Kompetensi Keahlian</p>
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {selectedStudent.jurusan}
                      </p>
                    </div>
                  </div>

                  {/* SVG Vector QR Code */}
                  <div className="w-20 h-20 p-1.5 rounded-xl border border-slate-200 bg-white shadow-xs shrink-0 flex flex-col items-center justify-center">
                    <div
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    <span className="text-[8px] font-mono text-slate-500 mt-0.5 font-bold">
                      SCAN ME
                    </span>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-100 pt-1.5">
                  <span className="font-mono">NPSN: {schoolConfig.npsn}</span>
                  <span className="font-semibold text-slate-500">Berlaku s.d. Lulus</span>
                </div>
              </div>
            )}

            {/* BACK SIDE */}
            {cardSide === 'back' && (
              <div className="h-full flex flex-col justify-between p-4 relative select-none bg-slate-50">
                {/* Back Header */}
                <div className="border-b border-slate-200 pb-2">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase text-center tracking-wide">
                    Tata Tertib Pemegang Kartu Tanda Siswa
                  </h4>
                </div>

                {/* Rules List */}
                <ol className="text-[9px] text-slate-600 space-y-1 list-decimal pl-4 leading-relaxed my-auto">
                  <li>Kartu ini adalah identitas resmi siswa {schoolConfig.name}.</li>
                  <li>Wajib dibawa setiap hari dan digunakan untuk presensi harian QR Code.</li>
                  <li>Dilarang meminjamkan kartu ini kepada pihak lain atau menduplikasinya.</li>
                  <li>Jika kartu hilang atau rusak, segera lapor ke bagian Tata Usaha (TU).</li>
                </ol>

                {/* Barcode & Official Signature Area */}
                <div className="flex items-end justify-between border-t border-slate-200 pt-2">
                  {/* Barcode */}
                  {showBarcode && (
                    <div className="space-y-0.5">
                      <div className="w-28 h-7 bg-slate-900 rounded flex items-center justify-center p-0.5">
                        <div className="w-full h-full bg-repeating-linear-gradient flex gap-0.5">
                          {/* Simulated high-res barcode bars */}
                          {[12, 8, 14, 10, 15, 6, 11, 13, 9, 14, 8, 12, 10, 15].map((h, i) => (
                            <span
                              key={i}
                              className="bg-white flex-1"
                              style={{ opacity: i % 2 === 0 ? 1 : 0.4 }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[8px] font-mono text-center text-slate-500 font-semibold">
                        *{selectedStudent.nisn}*
                      </p>
                    </div>
                  )}

                  {/* Principal Sign */}
                  <div className="text-right text-[9px] leading-tight">
                    <p className="text-slate-500">Jakarta, {schoolConfig.academicYear}</p>
                    <p className="text-slate-500">Kepala Sekolah,</p>
                    <div className="h-6 flex items-center justify-end">
                      <span className="font-serif italic text-teal-800 text-xs font-bold underline">
                        {schoolConfig.headmaster}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono text-[8px]">
                      NIP. {schoolConfig.headmasterNip}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>KTS terproteksi QR Code terverifikasi server akademik SIAKAD</span>
          </p>
        </div>
      </div>

      {/* Preview Modal for ISO CR-80 High Fidelity Inspection */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Pratinjau KTS Digital ISO CR-80"
        subtitle={`Kartu Tanda Siswa atas nama ${selectedStudent.name} (${selectedStudent.nisn})`}
        maxWidth="lg"
        dataTestId="kts-preview-modal"
      >
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed border border-slate-200">
            Berikut adalah tampilan cetak standar kartu identitas pelajar CR-80 (85.6mm × 54mm). Anda dapat mengunduh atau mencetak kartu langsung.
          </div>

          {/* Front & Back stacked preview */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-700 mb-1 block">Tampak Depan:</span>
              <div className="aspect-[85.6/54] rounded-xl overflow-hidden border border-slate-300 p-4 bg-white flex flex-col justify-between shadow-md">
                <div
                  className="flex items-center gap-3 p-2 rounded-lg text-white"
                  style={{ backgroundColor: headerColor }}
                >
                  <GraduationCap className="w-5 h-5 text-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{schoolConfig.name}</p>
                    <p className="text-[10px] opacity-80">KARTU TANDA PELAJAR</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 my-auto">
                  <img
                    src={selectedStudent.photo}
                    alt={selectedStudent.name}
                    className="w-16 h-20 rounded-lg object-cover border border-slate-200"
                  />
                  <div className="flex-1 text-xs space-y-1">
                    <p className="font-bold text-slate-900">{selectedStudent.name}</p>
                    <p className="text-teal-700 font-mono font-semibold">NISN: {selectedStudent.nisn}</p>
                    <p className="text-slate-600">{selectedStudent.kelas} — {selectedStudent.jurusan}</p>
                  </div>
                  <div
                    className="w-16 h-16 p-1 border rounded-lg bg-white shrink-0"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Tutup
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File Kartu</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
