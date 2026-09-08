import React, { useState } from 'react';
import { SpmbCandidate, SpmbWave, SchoolConfig } from '../../../types';
import {
  UserPlus,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Printer,
  ChevronRight,
  ChevronLeft,
  Upload,
  AlertCircle,
  Users,
  Search,
  Check,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { formatRupiah, addAuditLog, generateSvgQrMatrix } from '../../../utils/helpers';

interface SpmbModuleProps {
  waves: SpmbWave[];
  candidates: SpmbCandidate[];
  schoolConfig: SchoolConfig;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onConvertCandidateToStudent: (candidate: SpmbCandidate) => void;
}

export const SpmbModule: React.FC<SpmbModuleProps> = ({
  waves,
  candidates: initialCandidates,
  schoolConfig,
  onShowToast,
  onConvertCandidateToStudent,
}) => {
  const [candidates, setCandidates] = useState<SpmbCandidate[]>(initialCandidates);
  const [activeTab, setActiveTab] = useState<'pendaftar' | 'formulir_baru' | 'gelombang'>('pendaftar');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Step Registration Wizard State (Steps 1 to 5)
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    nisn: '',
    nik: '',
    gender: 'L' as 'L' | 'P',
    birthPlace: '',
    birthDate: '',
    chosenMajor: 'Rekayasa Perangkat Lunak',
    parentName: '',
    parentPhone: '',
    previousSchool: '',
    averageScore: '88.5',
    uploadedKk: 'berkas_kk_calon_siswa.pdf',
    uploadedAkta: 'akta_kelahiran.pdf',
  });

  // Selected Candidate for Admin Verification Modal
  const [selectedCandidate, setSelectedCandidate] = useState<SpmbCandidate | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');

  // Registration Proof Print Modal
  const [proofCandidate, setProofCandidate] = useState<SpmbCandidate | null>(null);

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.chosenMajor.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Handle Multi-step submit
  const handleWizardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const regNo = `SPMB-2026-${(candidates.length + 90).toString().padStart(4, '0')}`;
    const newCandidate: SpmbCandidate = {
      id: `SPMB-${Date.now()}`,
      registrationNumber: regNo,
      waveId: 'WAVE-1',
      name: formData.name || 'Calon Siswa Baru',
      nisn: formData.nisn || '0089123891',
      nik: formData.nik || '3171092819280001',
      gender: formData.gender,
      birthPlace: formData.birthPlace || 'Jakarta',
      birthDate: formData.birthDate || '2009-06-18',
      parentName: formData.parentName || 'Orang Tua Calon Siswa',
      parentPhone: formData.parentPhone || '081298761234',
      previousSchool: formData.previousSchool || 'SMP Negeri 1 Jakarta',
      averageReportScore: parseFloat(formData.averageScore) || 88.0,
      chosenMajor: formData.chosenMajor,
      status: 'Draft',
      registeredAt: '2026-09-08 08:00',
    };

    setCandidates([newCandidate, ...candidates]);
    addAuditLog('SPMB_REGISTER_ONLINE', `Pendaftaran online calon siswa baru: ${newCandidate.name} (${newCandidate.registrationNumber})`, newCandidate.name, 'calon_siswa');
    onShowToast('Pendaftaran Berhasil', `Nomor Pendaftaran resmi: ${regNo}. Silakan cetak bukti pendaftaran.`, 'success');
    
    // Open proof modal automatically
    setProofCandidate(newCandidate);
    setActiveTab('pendaftar');
    setCurrentStep(1);
  };

  // Handle Verification Status Change (Admin)
  const handleUpdateStatus = (newStatus: 'Verified' | 'Accepted' | 'Rejected') => {
    if (!selectedCandidate) return;

    const updated = candidates.map((c) => {
      if (c.id === selectedCandidate.id) {
        return {
          ...c,
          status: newStatus,
          verifiedBy: 'Panitia SPMB (Admin)',
          verifiedAt: '2026-09-08 08:15',
          notes: verifyNotes || `Status diperbarui menjadi ${newStatus}`,
        };
      }
      return c;
    });

    setCandidates(updated);

    if (newStatus === 'Accepted') {
      onConvertCandidateToStudent(selectedCandidate);
      addAuditLog('SPMB_CONVERT_STUDENT', `Calon siswa ${selectedCandidate.name} DITERIMA & akun siswa aktif otomatis dibuat`, 'Panitia SPMB', 'admin_tu');
      onShowToast('Siswa Diterima & Akun Dibuat', `${selectedCandidate.name} resmi diterima dan otomatis dikonversi menjadi akun Siswa aktif!`, 'success');
    } else {
      addAuditLog('SPMB_STATUS_UPDATE', `Status seleksi ${selectedCandidate.name} diubah menjadi ${newStatus}`, 'Panitia SPMB', 'admin_tu');
      onShowToast('Status Seleksi Diperbarui', `Calon siswa berstatus: ${newStatus}`, 'info');
    }

    setSelectedCandidate(null);
    setVerifyNotes('');
  };

  return (
    <div className="space-y-6" data-testid="spmb-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <span>Penerimaan Murid Baru (SPMB / PPDB Online)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan gelombang pendaftaran, formulir daring multi-step, seleksi verifikasi berkas, dan konversi otomatis
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('pendaftar')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'pendaftar'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-spmb-list"
          >
            Daftar Pendaftar ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('formulir_baru')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'formulir_baru'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-spmb-form"
          >
            Formulir Pendaftaran (5-Step)
          </button>
          <button
            onClick={() => setActiveTab('gelombang')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'gelombang'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-spmb-waves"
          >
            Status Kuota Gelombang
          </button>
        </div>
      </div>

      {/* VIEW 1: DAFTAR PENDAFTAR & VERIFIKASI ADMIN */}
      {activeTab === 'pendaftar' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Data Calon Siswa Terdaftar (Seleksi Tahun Ajaran 2026/2027)
            </h3>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, no. registrasi, jurusan..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">No. Registrasi</th>
                  <th className="p-3.5">Nama Calon Siswa</th>
                  <th className="p-3.5">Asal Sekolah</th>
                  <th className="p-3.5">Pilihan Jurusan</th>
                  <th className="p-3.5 text-center">Rata-rata Rapor</th>
                  <th className="p-3.5">Status Seleksi</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-mono font-bold text-teal-800">{c.registrationNumber}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] font-mono text-slate-400">NISN: {c.nisn}</p>
                    </td>
                    <td className="p-3.5 text-slate-600">{c.previousSchool}</td>
                    <td className="p-3.5 font-semibold text-slate-800">{c.chosenMajor}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-teal-700">
                      {c.averageReportScore}
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          c.status === 'Accepted'
                            ? 'success'
                            : c.status === 'Verified'
                            ? 'info'
                            : c.status === 'Rejected'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setProofCandidate(c)}
                          className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                          title="Cetak Bukti Pendaftaran"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedCandidate(c)}
                          className="px-2.5 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors"
                          data-testid={`btn-verify-${c.id}`}
                        >
                          Verifikasi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: FORMULIR MULTI-STEP PENDAFTARAN (5 LANGKAH) */}
      {activeTab === 'formulir_baru' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-3xl mx-auto space-y-6">
          {/* Step Progress Indicators */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            {[1, 2, 3, 4, 5].map((step) => {
              const stepLabels = ['Akun & Jurusan', 'Data Diri', 'Orang Tua', 'Asal Sekolah', 'Upload & Review'];
              const isDone = currentStep > step;
              const isCurrent = currentStep === step;

              return (
                <div key={step} className="flex flex-col items-center text-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                      isDone
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-teal-50 text-teal-700 border-2 border-teal-500 ring-2 ring-teal-500/20'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1.5 hidden sm:block">
                    {stepLabels[step - 1]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <form onSubmit={handleWizardSubmit} className="space-y-4">
            {/* STEP 1 */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Langkah 1: Akun Pendaftaran & Pilihan Jurusan
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilihan Program / Kompetensi Keahlian (SMK)
                  </label>
                  <select
                    value={formData.chosenMajor}
                    onChange={(e) => setFormData({ ...formData, chosenMajor: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-teal-500 font-semibold"
                  >
                    <option value="Rekayasa Perangkat Lunak">Rekayasa Perangkat Lunak (RPL)</option>
                    <option value="Teknik Komputer & Jaringan">Teknik Komputer & Jaringan (TKJ)</option>
                    <option value="Desain Komunikasi Visual">Desain Komunikasi Visual (DKV)</option>
                    <option value="Teknik Pengelasan & Fabrikasi Logam">Teknik Pengelasan & Fabrikasi Logam (TFL)</option>
                  </select>
                </div>

                <div className="p-3.5 bg-teal-50/50 rounded-xl border border-teal-200 text-xs text-teal-900 leading-relaxed">
                  Pendaftaran saat ini masuk ke dalam <strong>Gelombang 1: Jalur Prestasi & Reguler</strong>. Kuota jurusan terisi secara real-time.
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Langkah 2: Data Diri Calon Siswa
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Lengkap (Sesuai Akta Kelahiran)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Contoh: Muhammad Dimas Saputra"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">NISN (10 Digit)</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.nisn}
                      onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                      required
                      placeholder="0089123891"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">NIK (16 Digit)</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={formData.nik}
                      onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                      required
                      placeholder="3171092819280001"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tempat Lahir</label>
                    <input
                      type="text"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                      required
                      placeholder="Jakarta"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Langkah 3: Data Orang Tua / Wali
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Ayah / Ibu / Wali</label>
                  <input
                    type="text"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    required
                    placeholder="Contoh: Haryanto Saputra"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">No. Handphone / WhatsApp Orang Tua (Aktif)</label>
                  <input
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    required
                    placeholder="Contoh: 081299887766"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nomor ini akan menerima notifikasi resmi kelulusan via WhatsApp Gateway.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Langkah 4: Asal Sekolah & Nilai Akademik
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Asal SMP / MTs</label>
                  <input
                    type="text"
                    value={formData.previousSchool}
                    onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                    required
                    placeholder="Contoh: SMP Negeri 1 Jakarta"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rata-rata Nilai Rapor Semester 1 - 5</label>
                  <input
                    type="number"
                    step="0.1"
                    min="60"
                    max="100"
                    value={formData.averageScore}
                    onChange={(e) => setFormData({ ...formData, averageScore: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800 font-bold"
                  />
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {currentStep === 5 && (
              <div className="space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Langkah 5: Upload Berkas & Tinjauan Akhir
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-1">
                    <Upload className="w-5 h-5 text-teal-600 mx-auto" />
                    <p className="font-bold text-slate-800">Kartu Keluarga (KK)</p>
                    <p className="text-[10px] text-teal-700 font-mono">{formData.uploadedKk}</p>
                  </div>

                  <div className="p-3 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-1">
                    <Upload className="w-5 h-5 text-teal-600 mx-auto" />
                    <p className="font-bold text-slate-800">Akta Kelahiran</p>
                    <p className="text-[10px] text-teal-700 font-mono">{formData.uploadedAkta}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <h5 className="font-bold text-slate-900">Ringkasan Data Formulir:</h5>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-400">Nama:</span>
                      <p className="font-semibold text-slate-900">{formData.name || 'Muhammad Dimas'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Pilihan Jurusan:</span>
                      <p className="font-semibold text-slate-900">{formData.chosenMajor}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">NISN / NIK:</span>
                      <p className="font-mono text-slate-900">{formData.nisn || '0089123891'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Asal SMP:</span>
                      <p className="font-semibold text-slate-900">{formData.previousSchool || 'SMPN 1 Jakarta'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <span>Lanjutkan</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kirim Formulir Pendaftaran</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* VIEW 3: GELOMBANG & PROGRESS BAR KUOTA */}
      {activeTab === 'gelombang' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {waves.map((w) => {
            const fillPercent = Math.round((w.filled / w.quota) * 100);
            const remaining = w.quota - w.filled;

            return (
              <div
                key={w.id}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={w.isActive ? 'success' : 'neutral'}>
                    {w.isActive ? 'Pendaftaran Dibuka' : 'Akan Datang'}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-teal-700">
                    Biaya: {formatRupiah(w.fee)}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{w.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Periode: {w.startDate} s.d. {w.endDate}
                  </p>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Keterisian Kuota</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {w.filled} / {w.quota} Kursi ({fillPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        fillPercent > 80 ? 'bg-amber-500' : 'bg-teal-600'
                      }`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Sisa kursi tersedia: <strong>{remaining} kursi</strong>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADMIN VERIFICATION MODAL */}
      {selectedCandidate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCandidate(null)}
          title={`Verifikasi Calon Siswa: ${selectedCandidate.name}`}
          subtitle={`No. Registrasi: ${selectedCandidate.registrationNumber} — Asal: ${selectedCandidate.previousSchool}`}
          maxWidth="md"
          dataTestId="spmb-verification-modal"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Pilihan Jurusan:</span>
                <span className="font-bold text-slate-900">{selectedCandidate.chosenMajor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rata-rata Nilai Rapor:</span>
                <span className="font-mono font-bold text-teal-700">
                  {selectedCandidate.averageReportScore}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor HP Orang Tua:</span>
                <span className="font-mono text-slate-800">{selectedCandidate.parentPhone}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan Verifikator / Alasan (Opsional)
              </label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Contoh: Berkas persyaratan sah dan memenuhi standar passing grade"
                rows={3}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 text-slate-800"
              />
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleUpdateStatus('Rejected')}
                className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                data-testid="btn-spmb-reject"
              >
                Tolak Pendaftar
              </button>
              <button
                onClick={() => handleUpdateStatus('Verified')}
                className="px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
                data-testid="btn-spmb-verify"
              >
                Verifikasi Berkas
              </button>
              <button
                onClick={() => handleUpdateStatus('Accepted')}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
                data-testid="btn-spmb-accept"
              >
                Terima & Buat Akun Siswa
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* REGISTRATION PROOF PRINT MODAL */}
      {proofCandidate && (
        <Modal
          isOpen={true}
          onClose={() => setProofCandidate(null)}
          title="Bukti Pendaftaran Resmi PPDB / SPMB Online"
          subtitle={`No. Pendaftaran: ${proofCandidate.registrationNumber}`}
          maxWidth="2xl"
          dataTestId="proof-print-modal"
        >
          <div className="space-y-6">
            <div className="p-8 bg-white border border-slate-300 rounded-2xl shadow-sm text-slate-900 space-y-6 font-sans">
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-10 h-10 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-extrabold uppercase">PANITIA SPMB ONLINE</h3>
                    <p className="text-xs font-bold">{schoolConfig.name}</p>
                    <p className="text-[10px] text-slate-500">Tahun Akademik {schoolConfig.academicYear}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold bg-teal-50 text-teal-900 px-3 py-1 rounded border border-teal-200 block">
                    BUKTI PENDAFTARAN
                  </span>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">{proofCandidate.registrationNumber}</p>
                </div>
              </div>

              <table className="w-full text-xs space-y-2">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500 w-36">Nama Lengkap</td>
                    <td className="py-2 font-bold text-slate-900">{proofCandidate.name}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">NISN / NIK</td>
                    <td className="py-2 font-mono text-slate-800">{proofCandidate.nisn} / {proofCandidate.nik}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Pilihan Jurusan</td>
                    <td className="py-2 font-bold text-teal-800">{proofCandidate.chosenMajor}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Asal Sekolah</td>
                    <td className="py-2 text-slate-800">{proofCandidate.previousSchool}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Rata-rata Rapor</td>
                    <td className="py-2 font-mono font-bold text-slate-900">{proofCandidate.averageReportScore}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Status Pendaftaran</td>
                    <td className="py-2">
                      <Badge variant="success">{proofCandidate.status}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div
                  className="w-20 h-20 p-1 border border-slate-200 rounded-lg bg-white shrink-0"
                  dangerouslySetInnerHTML={{
                    __html: generateSvgQrMatrix(`SPMB:${proofCandidate.registrationNumber};NAMA:${proofCandidate.name}`, 80, '#0f172a'),
                  }}
                />
                <div className="text-right text-xs">
                  <p className="text-slate-500">Tanggal Cetak: 2026-09-08</p>
                  <p className="text-slate-500 font-bold mt-1">Panitia Penerimaan Murid Baru</p>
                  <p className="text-[10px] text-slate-400 mt-4">Tanda Tangan & Stempel Resmi Digital</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setProofCandidate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  window.print();
                  onShowToast('Cetak Bukti SPMB', 'Membuka dialog pencetak bukti pendaftaran.', 'info');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar Bukti</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
