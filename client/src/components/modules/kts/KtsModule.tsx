import React, { useState, useEffect, useCallback } from 'react';
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
  Save,
  Ban,
  RefreshCw,
} from 'lucide-react';
import {generateSvgQrMatrix, initialsAvatar} from '../../../utils/helpers';
import { Modal } from '../../common/Modal';
import { EmptyState } from '../../common/EmptyState';
import {
  KtsApiService,
  type ServerKtsTemplate,
  type ServerKtsToken,
} from '../../../services/OpsApiService';
import { StudentService } from '../../../services/DomainService';
import { TokenStorage } from '../../../services/TokenStorage';

/** NIK pada kartu selalu termask (FRD §7.1); API tidak pernah mengirim NIK asli. */
function maskedCardNik(nik: string): string {
  const digits = (nik ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '••••';
}

/** Field kartu yang dapat disembunyikan lewat template server. */
const CARD_VISIBILITY_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Nama Lengkap' },
  { key: 'nisn', label: 'NISN' },
  { key: 'nik', label: 'NIK (termask)' },
  { key: 'class', label: 'Kelas' },
  { key: 'major', label: 'Jurusan' },
  { key: 'qr', label: 'QR Code' },
];

const CARD_VISIBILITY_DEFAULTS: Record<string, boolean> = {
  logo: true,
  photo: true,
  name: true,
  nisn: true,
  nik: true,
  class: true,
  major: true,
  qr: true,
};

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
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(students[0] ?? null);
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

  // Template KTS server (berversi) — builder panel
  const [template, setTemplate] = useState<ServerKtsTemplate | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [templateWatermark, setTemplateWatermark] = useState('');
  const [templateVisibility, setTemplateVisibility] = useState<Record<string, boolean>>({
    ...CARD_VISIBILITY_DEFAULTS,
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Data server: id kanonik siswa, daftar siswa, riwayat token, modal QR
  const [serverStudentId, setServerStudentId] = useState<string | null>(null);
  const [serverStudents, setServerStudents] = useState<Student[] | null>(null);
  const [serverTokens, setServerTokens] = useState<ServerKtsToken[] | null>(null);
  const [qrTarget, setQrTarget] = useState<Student | null>(null);
  const [qrModalSvg, setQrModalSvg] = useState('');
  const [qrModalState, setQrModalState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [issueNonce, setIssueNonce] = useState(0);
  // Foto kartu: URL bertanda tangan dari server setelah unggah berhasil.
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Roster kartu: server-first (operator/admin), fallback mock DEV. Bundle
  // produksi membuang mock — tanpa roster server, kanvas KTS selalu kosong.
  const roster = serverStudents ?? students;

  // QR signed server (HMAC) bila operator login & siswa terdaftar di server.
  const [serverQr, setServerQr] = useState<{
    payload: string;
    signature: string;
    tokenId: string | null;
  } | null>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  /** Terapkan template server ke state builder (warna, watermark, visibilitas). */
  const applyServerTemplate = useCallback((tpl: ServerKtsTemplate) => {
    setTemplate(tpl);
    const header = tpl.colors?.header;
    const background = tpl.colors?.background;
    if (typeof header === 'string' && header !== '') setHeaderColor(header);
    if (typeof background === 'string' && background !== '') setBackgroundColor(background);
    setTemplateWatermark(tpl.watermark ?? '');
    setTemplateVisibility((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const value = tpl.visibility?.[key];
        if (typeof value === 'boolean') next[key] = value;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void KtsApiService.template()
      .then((tpl) => {
        if (!cancelled) applyServerTemplate(tpl);
      })
      .catch(() => {
        /* tanpa izin/offline: builder tetap memakai nilai lokal */
      });
    return () => {
      cancelled = true;
    };
  }, [applyServerTemplate]);

  /** Katalog siswa server — sumber id kanonik untuk kartu PDF & QR. */
  const loadServerStudents = useCallback(() => {
    if (!TokenStorage.hasSession()) return;
    void StudentService.list()
      .then((rows) => setServerStudents(rows))
      .catch(() => setServerStudents(null));
  }, []);

  useEffect(() => {
    loadServerStudents();
  }, [loadServerStudents]);

  // Siswa terpilih mengikuti roster: pilih baris pertama saat kanvas masih
  // kosong (produksi tanpa mock), pertahankan pilihan bila masih ada di roster.
  useEffect(() => {
    if (roster.length === 0) return;
    setSelectedStudent((prev) =>
      prev && roster.some((s) => s.id === prev.id || s.nisn === prev.nisn) ? prev : roster[0],
    );
  }, [roster]);

  /** Riwayat token QR satu siswa — dasar panel pencabutan. */
  const loadServerTokens = useCallback((studentId: string) => {
    void KtsApiService.tokens(studentId)
      .then((rows) => setServerTokens(rows))
      .catch(() => setServerTokens(null));
  }, []);

  useEffect(() => {
    if (!TokenStorage.hasSession() || !selectedStudent) {
      setServerQr(null);
      setServerStudentId(null);
      setServerTokens(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const found = await StudentService.list(selectedStudent.nisn);
        const serverId = found[0]?.id;
        if (!serverId || cancelled) {
          if (!cancelled) {
            setServerQr(null);
            setServerStudentId(null);
          }
          return;
        }
        setServerStudentId(serverId);
        const issued = await KtsApiService.issue(serverId);
        if (cancelled) return;
        setServerQr({
          payload: issued.payload,
          signature: issued.signature,
          tokenId: issued.token_id ?? null,
        });
        // Token yang baru terbit wajib tampil di panel revoke.
        loadServerTokens(serverId);
      } catch {
        if (!cancelled) {
          setServerQr(null);
          setServerStudentId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudent?.nisn, issueNonce, loadServerTokens]);

  // QR hanya sah bila diterbitkan server (HMAC). Tanpa itu: tidak ada QR sama sekali,
  // bukan QR palsu yang tidak bisa diverifikasi.
  const [qrSvg, setQrSvg] = useState('');

  useEffect(() => {
    if (!serverQr) {
      setQrSvg('');
      return;
    }
    let cancelled = false;
    void generateSvgQrMatrix(
      JSON.stringify({ payload: serverQr.payload, signature: serverQr.signature }),
      140,
      accentColor
    ).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [serverQr, accentColor]);

  // QR vektor siswa langsung dari server (SVG bertanda tangan, bukan NISN mentah).
  useEffect(() => {
    if (!qrTarget) {
      setQrModalSvg('');
      setQrModalState('idle');
      return;
    }
    let cancelled = false;
    setQrModalSvg('');
    setQrModalState('loading');
    const bearer = TokenStorage.getToken();
    void fetch(KtsApiService.qrUrl(qrTarget.id), {
      credentials: 'include',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((svg) => {
        if (cancelled) return;
        setQrModalSvg(svg);
        setQrModalState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setQrModalSvg('');
        setQrModalState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [qrTarget]);

  if (!selectedStudent) {
    return (
      <div className="space-y-6" data-testid="kts-module">
        <EmptyState
          title="Belum ada data siswa"
          message="Kanvas kartu membutuhkan data siswa. Login operator/admin lalu muat ulang — daftar siswa diambil dari server."
          testId="kts-empty-state"
        />
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
    onShowToast('Cetak KTS Digital', 'Membuka dialog pencetak browser format ISO CR-80 (85.6mm × 54mm)', 'info');
  };

  /** Unggah foto siswa: berkas inilah yang ditanam pada kartu PDF server. */
  const handleUploadPhoto = async (file: File | null) => {
    if (!file) return;

    if (!serverStudentId) {
      onShowToast('Foto Belum Bisa Diunggah', 'Pilih siswa terdaftar di server (login operator) terlebih dahulu.', 'warning');
      return;
    }

    setUploadingPhoto(true);

    try {
      const result = await KtsApiService.uploadPhoto(serverStudentId, file);
      setPhotoUrl(result.photo_url ?? '');
      // Kanvas & pratinjau langsung memakai foto asli.
      setSelectedStudent((prev) => (prev ? { ...prev, photo: result.photo_url ?? '' } : prev));
      onShowToast('Foto Tersimpan', 'Foto siswa tersimpan di server dan dipakai pada kartu PDF.', 'success');
    } catch {
      onShowToast('Unggah Foto Gagal', 'Server menolak berkas (format JPG/PNG maks 2 MB).', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  /** Server menyimpan VERSI BARU setiap penyimpanan — versi lama tetap utuh. */
  const handleSaveTemplate = () => {
    if (!TokenStorage.hasSession()) {
      onShowToast('Perlu Login', 'Template KTS tersimpan di server — login operator untuk menyimpan.', 'warning');
      return;
    }
    setIsSavingTemplate(true);
    void KtsApiService.saveTemplate({
      colors: { header: headerColor, background: backgroundColor },
      visibility: templateVisibility,
      watermark: templateWatermark.trim() === '' ? null : templateWatermark.trim(),
    })
      .then((saved) => {
        applyServerTemplate(saved);
        onShowToast(
          'Template KTS Tersimpan',
          `Versi ${saved.version} kini aktif; versi sebelumnya tetap tersimpan sebagai riwayat.`,
          'success',
        );
      })
      .catch(() => {
        onShowToast('Gagal Menyimpan Template', 'Server menolak perubahan template. Coba lagi.', 'error');
      })
      .finally(() => setIsSavingTemplate(false));
  };

  const handleRevokeToken = (token: ServerKtsToken) => {
    void KtsApiService.revoke(token.id)
      .then(() => {
        onShowToast(
          'Token QR Dicabut',
          `Token ${token.id.slice(0, 8)}… tidak lagi valid untuk presensi.`,
          'success',
        );
        if (serverStudentId) loadServerTokens(serverStudentId);
        if (serverQr?.tokenId === token.id) {
          // Kanvas menampilkan QR yang baru dicabut: terbitkan token pengganti.
          setServerQr(null);
          setIssueNonce((n) => n + 1);
        }
      })
      .catch(() => onShowToast('Gagal Mencabut Token', 'Server menolak permintaan revoke.', 'error'));
  };

  const handleSelectServerStudent = (row: Student) => {
    setSelectedStudent(row);
  };

  const handleVerify = () => {
    if (!serverQr) {
      onShowToast('Belum Ada QR Server', 'Login sebagai operator & pilih siswa terdaftar untuk verifikasi.', 'warning');
      return;
    }
    setVerifyState('checking');
    void KtsApiService.verify(serverQr.payload, serverQr.signature)
      .then((res) => {
        setVerifyState(res.valid ? 'valid' : 'invalid');
        onShowToast(
          res.valid ? 'QR Valid' : 'QR Tidak Valid',
          res.valid ? `NISN ${res.nisn} terverifikasi server.` : 'Payload/signature ditolak server.',
          res.valid ? 'success' : 'error',
        );
      })
      .catch(() => {
        setVerifyState('invalid');
        onShowToast('Verifikasi Gagal', 'Server tidak merespons. Coba lagi.', 'error');
      });
  };

  /** Kartu PDF asli dari server (bukan snapshot klien). */
  const handleDownload = () => {
    if (!serverStudentId) {
      onShowToast('PDF Belum Tersedia', 'Login operator & pilih siswa terdaftar di server.', 'warning');
      return;
    }
    window.open(KtsApiService.cardUrl(serverStudentId), '_blank', 'noopener');
    onShowToast('Mengunduh KTS PDF', `Kartu ${selectedStudent.name} diunduh dari server.`, 'info');
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
          {serverQr !== null && (
            <p className="mt-1.5" data-testid="kts-signed-badge">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                QR SIGNED SERVER (HMAC-SHA256, dapat diverifikasi)
              </span>
            </p>
          )}
          {verifyState === 'valid' && (
            <p className="mt-1.5" data-testid="kts-verify-valid">
              <span className="inline-block px-2 py-0.5 rounded-full bg-teal-700 text-white text-[10px] font-bold font-mono">
                QR TERVERIFIKASI SERVER
              </span>
            </p>
          )}
          {verifyState === 'invalid' && serverQr !== null && (
            <p className="mt-1.5" data-testid="kts-verify-invalid">
              <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold font-mono">
                QR DITOLAK SERVER
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            data-testid="btn-preview-kts"
          >
            <Eye className="w-4 h-4 text-slate-600" />
            <span>Pratinjau KTS</span>
          </button>
          <button
            onClick={handleVerify}
            disabled={!serverQr || verifyState === 'checking'}
            className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors disabled:opacity-50"
            data-testid="btn-verify-kts"
            title="Verifikasi QR via POST /kts/verify"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{verifyState === 'checking' ? 'Memeriksa…' : 'Verifikasi QR'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-all shadow-sm shadow-teal-600/20"
            data-testid="btn-print-kts"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak KTS CR-80</span>
          </button>
          <a
            href={serverStudentId ? KtsApiService.cardUrl(serverStudentId) : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!serverStudentId) {
                event.preventDefault();
                onShowToast('PDF Belum Tersedia', 'Login operator & pilih siswa terdaftar di server.', 'warning');
                return;
              }
              onShowToast(
                'Mengunduh KTS PDF',
                `Kartu ${selectedStudent.name} diunduh dari server (PDF resmi).`,
                'info',
              );
            }}
            className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            data-testid="btn-kts-download-pdf"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Unduh PDF KTS</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Student Selector & Template Customizer */}
        <div className="lg:col-span-4 space-y-6">
          {/* Select Student */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <label htmlFor="kts-student-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Pilih Data Siswa
            </label>
            <select
              id="kts-student-select"
              value={selectedStudent.id}
              onChange={(e) => {
                const s = roster.find((item) => item.id === e.target.value);
                if (s) setSelectedStudent(s);
              }}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              data-testid="select-kts-student"
            >
              {roster.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.nisn} — {student.name} ({student.kelas})
                </option>
              ))}
            </select>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Jurusan:</span>
                <span className="font-semibold text-slate-800">{selectedStudent.jurusan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIK (Masked):</span>
                <span className="font-mono text-slate-800">{maskedCardNik(selectedStudent.nik)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tempat/Tgl Lahir:</span>
                <span className="text-slate-800">{selectedStudent.birthPlace || selectedStudent.birthDate ? `${selectedStudent.birthPlace}, ${selectedStudent.birthDate}` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Foto siswa: berkas ini yang ditanam pada kartu PDF server */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3" data-testid="kts-photo-panel">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-teal-600" />
              <span>Foto Siswa (Kartu)</span>
            </span>

            <label htmlFor="kts-photo-input" className="block text-[11px] font-medium text-slate-600">
              Pilih berkas foto (JPG/PNG, maks 2 MB)
            </label>

            <input
              id="kts-photo-input"
              type="file"
              accept="image/jpeg,image/png"
              disabled={!serverStudentId || uploadingPhoto}
              onChange={(e) => {
                void handleUploadPhoto(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
              className="block w-full text-xs text-slate-600 file:mr-2 file:min-h-11 file:px-3 file:rounded-xl file:border file:border-slate-200 file:bg-slate-50 file:text-xs file:font-semibold disabled:opacity-50"
              data-testid="input-kts-photo"
            />

            {photoUrl !== '' ? (
              <img
                src={photoUrl}
                alt={`Foto ${selectedStudent.name}`}
                className="w-20 h-24 object-cover rounded-xl border border-slate-200"
                data-testid="kts-photo-preview"
              />
            ) : (
              <p className="text-[11px] text-slate-500">
                {serverStudentId
                  ? 'Belum ada foto tersimpan. Format JPG/PNG, maks 2 MB.'
                  : 'Pilih siswa terdaftar di server (login operator) untuk mengunggah foto.'}
              </p>
            )}
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
                className="text-[11px] text-teal-700 hover:underline flex items-center gap-1 font-medium min-h-11"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Header Color Picker */}
            <div>
              <label htmlFor="kts-header-color" className="block text-xs font-medium text-slate-700 mb-1.5">Warna Header Kartu</label>
              <div className="flex items-center gap-2">
                <input
                  id="kts-header-color"
                  type="color"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                />
                <span className="text-xs font-mono text-slate-700">{headerColor}</span>
              </div>
            </div>

            {/* Accent Color Picker */}
            <div>
              <label htmlFor="kts-accent-color" className="block text-xs font-medium text-slate-700 mb-1.5">Warna Aksen & QR Code</label>
              <div className="flex items-center gap-2">
                <input
                  id="kts-accent-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                />
                <span className="text-xs font-mono text-slate-700">{accentColor}</span>
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

          {/* Template KTS Server: setiap simpan membuat VERSI BARU (riwayat immutable) */}
          <div
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4"
            data-testid="kts-template-builder"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-teal-600" />
                <span>Template KTS Server</span>
              </span>
              <span
                className="inline-block px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold font-mono"
                data-testid="kts-template-version"
              >
                {template ? `v${template.version} aktif` : 'v—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="kts-color-header" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Warna Header
                </label>
                <input
                  id="kts-color-header"
                  type="color"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                  className="w-full h-9 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  data-testid="input-kts-color-header"
                />
              </div>
              <div>
                <label htmlFor="kts-color-background" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Warna Latar
                </label>
                <input
                  id="kts-color-background"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full h-9 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  data-testid="input-kts-color-background"
                />
              </div>
            </div>

            <div>
              <label htmlFor="kts-watermark" className="block text-xs font-medium text-slate-700 mb-1.5">
                Watermark Teks
              </label>
              <input
                id="kts-watermark"
                type="text"
                value={templateWatermark}
                maxLength={64}
                onChange={(e) => setTemplateWatermark(e.target.value)}
                placeholder="cth. SIAKAD 2026"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                data-testid="input-kts-watermark"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="block text-xs font-medium text-slate-700">Field Tampil di Kartu</span>
              {CARD_VISIBILITY_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-700">{field.label}</span>
                  <input
                    type="checkbox"
                    checked={templateVisibility[field.key] ?? true}
                    onChange={(e) =>
                      setTemplateVisibility((prev) => ({ ...prev, [field.key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    data-testid={`toggle-kts-visible-${field.key}`}
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isSavingTemplate}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors disabled:opacity-50"
              data-testid="btn-kts-save-template"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingTemplate ? 'Menyimpan…' : 'Simpan Template (Versi Baru)'}</span>
            </button>
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
                  ? 'bg-teal-700 text-white shadow-xs'
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
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="toggle-kts-back"
            >
              Tampak Belakang
            </button>
          </div>

          {/* CARD CONTAINER (Preserves ISO CR-80 Aspect Ratio 85.6mm x 54mm -> approx 1.585) */}
          <div
            className="w-full max-w-[460px] aspect-[85.6/54] relative shadow-2xl rounded-2xl overflow-hidden border border-slate-300 bg-white transition-all transform hover:scale-[1.01]"
            style={{ backgroundColor }}
          >
            {/* FRONT SIDE */}
            {cardSide === 'front' && (
              <div className="h-full flex flex-col justify-between p-4 relative select-none">
                {/* Background Watermark */}
                {showWatermark && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                    <GraduationCap className="w-64 h-64 text-slate-900" />
                  </div>
                )}
                {templateWatermark.trim() !== '' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
                    <span className="text-2xl font-black uppercase tracking-widest text-slate-900 -rotate-[18deg]">
                      {templateWatermark}
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <div
                  className="flex items-center gap-3 p-2.5 rounded-xl text-white shadow-xs"
                  style={{ backgroundColor: headerColor }}
                >
                  {templateVisibility.logo && (
                    <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                  )}
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

                {/* Card Body: Photo, Details & QR Code — visibilitas mengikuti template server */}
                <div className="flex items-center gap-4 my-auto pt-2">
                  {/* Student Photo */}
                  {templateVisibility.photo && (
                    <div className="w-24 h-28 rounded-xl overflow-hidden border-2 border-slate-200 shadow-xs shrink-0 bg-slate-100">
                      <img
                        src={selectedStudent.photo !== '' ? selectedStudent.photo : initialsAvatar(selectedStudent.name)}
                        alt={selectedStudent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Student Details */}
                  <div className="flex-1 min-w-0 space-y-1 text-slate-800 text-xs">
                    {templateVisibility.name && (
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                          Nama Lengkap
                        </p>
                        <p className="font-bold text-slate-900 text-sm truncate leading-tight">
                          {selectedStudent.name}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                      {templateVisibility.nisn && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-semibold">NISN</p>
                          <p className="font-mono font-bold text-teal-700">{selectedStudent.nisn}</p>
                        </div>
                      )}
                      {templateVisibility.class && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-semibold">Kelas</p>
                          <p className="font-semibold">{selectedStudent.kelas}</p>
                        </div>
                      )}
                      {templateVisibility.nik && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-semibold">NIK</p>
                          <p className="font-mono font-semibold">{maskedCardNik(selectedStudent.nik)}</p>
                        </div>
                      )}
                    </div>
                    {templateVisibility.major && (
                      <div>
                        <p className="text-[9px] text-slate-500 font-semibold">Kompetensi Keahlian</p>
                        <p className="text-[11px] font-semibold text-slate-700 truncate">
                          {selectedStudent.jurusan}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SVG Vector QR Code — hanya bila server menerbitkan (terscan & terverifikasi) */}
                  {templateVisibility.qr && (
                    <div className="w-20 h-20 p-1.5 rounded-xl border border-slate-200 bg-white shadow-xs shrink-0 flex flex-col items-center justify-center">
                      {serverQr ? (
                        <>
                          <div
                            className="w-full h-full"
                            dangerouslySetInnerHTML={{ __html: qrSvg }}
                          />
                          <span className="text-[8px] font-mono text-slate-500 mt-0.5 font-bold">
                            SCAN ME
                          </span>
                        </>
                      ) : (
                        <span className="text-[7px] font-mono text-slate-400 font-bold text-center leading-tight">
                          QR BELUM TERBIT
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-100 pt-1.5">
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

          <p className="text-[11px] text-slate-600 mt-4 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>KTS terproteksi QR Code terverifikasi server akademik SIAKAD</span>
          </p>
        </div>
      </div>

      {/* QR per siswa (vektor server) + riwayat token yang bisa dicabut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
          data-testid="kts-student-qr-list"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>QR Siswa (Vektor Server)</span>
            </span>
            <button
              type="button"
              onClick={loadServerStudents}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline min-h-11"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Muat Ulang</span>
            </button>
          </div>

          {serverStudents === null ? (
            <p className="text-xs text-slate-500">
              Daftar siswa server belum tersedia. Login operator untuk memuat QR siswa.
            </p>
          ) : serverStudents.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada siswa terdaftar di server.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {serverStudents.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-teal-300 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectServerStudent(row)}
                    className="flex-1 min-w-0 text-left min-h-11"
                  >
                    <p className="text-xs font-semibold text-slate-800 truncate">{row.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">{row.nisn}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrTarget(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors shrink-0"
                    data-testid={`btn-kts-qr-${row.nisn.slice(0, 8)}`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
          data-testid="kts-token-list"
        >
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Token QR Siswa Terpilih</span>
          </span>
          <p className="text-[11px] text-slate-500">
            Cabut token yang bocor atau disalahgunakan; token pengganti diterbitkan saat siswa dipilih ulang.
          </p>

          {serverTokens === null ? (
            <p className="text-xs text-slate-500">
              Riwayat token belum tersedia. Login operator untuk melihat dan mencabut token.
            </p>
          ) : serverTokens.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada token QR untuk siswa ini.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {serverTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-slate-800 truncate">
                      {token.jti}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      id {token.id.slice(0, 8)}… • {token.valid ? 'valid' : 'dicabut/kedaluwarsa'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeToken(token)}
                    disabled={!token.valid}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                    data-testid={`btn-kts-revoke-${token.id.slice(0, 8)}`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cabut</span>
                  </button>
                </div>
              ))}
            </div>
          )}
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
        <div className="space-y-6" data-testid="modal-kts-preview">
          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed border border-slate-200">
            Berikut adalah tampilan cetak standar kartu identitas pelajar CR-80 (85.6mm × 54mm). Anda dapat mengunduh PDF resmi atau mencetak kartu langsung.
          </div>

          {/* Kartu siap cetak: ukuran fisik dikunci .printable-card (index.css) */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Tampak Depan (siap cetak 85.6mm × 54mm):
            </span>
            <div
              className="printable-card w-full max-w-[460px] mx-auto aspect-[85.6/54] rounded-xl overflow-hidden border border-slate-300 shadow-md relative flex flex-col justify-between p-4 select-none"
              style={{ backgroundColor }}
            >
              {templateWatermark.trim() !== '' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
                  <span className="text-2xl font-black uppercase tracking-widest text-slate-900 -rotate-[18deg]">
                    {templateWatermark}
                  </span>
                </div>
              )}

              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-white"
                style={{ backgroundColor: headerColor }}
              >
                {templateVisibility.logo && <GraduationCap className="w-5 h-5 text-white" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{schoolConfig.name}</p>
                  <p className="text-[10px] opacity-80">KARTU TANDA PELAJAR (KTS)</p>
                </div>
                <span className="text-[9px] font-mono opacity-80">CR-80</span>
              </div>

              <div className="flex items-center gap-3 my-auto">
                {templateVisibility.photo && (
                  <img
                    src={selectedStudent.photo !== '' ? selectedStudent.photo : initialsAvatar(selectedStudent.name)}
                    alt={selectedStudent.name}
                    className="w-16 h-20 rounded-lg object-cover border border-slate-200"
                  />
                )}
                <div className="flex-1 min-w-0 text-xs space-y-1">
                  {templateVisibility.name && (
                    <p className="font-bold text-slate-900 truncate">{selectedStudent.name}</p>
                  )}
                  {templateVisibility.nisn && (
                    <p className="text-teal-700 font-mono font-semibold">NISN: {selectedStudent.nisn}</p>
                  )}
                  {templateVisibility.nik && (
                    <p className="text-slate-600 font-mono font-semibold">
                      NIK: {maskedCardNik(selectedStudent.nik)}
                    </p>
                  )}
                  {templateVisibility.class && (
                    <p className="text-slate-600">Kelas {selectedStudent.kelas}</p>
                  )}
                  {templateVisibility.major && (
                    <p className="text-slate-600 truncate">{selectedStudent.jurusan}</p>
                  )}
                </div>
                {templateVisibility.qr && (
                  <div className="w-16 h-16 p-1 border rounded-lg bg-white shrink-0 flex items-center justify-center">
                    {serverQr ? (
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    ) : (
                      <QrCode className="w-6 h-6 text-slate-300" aria-hidden="true" />
                    )}
                  </div>
                )}
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
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              data-testid="btn-kts-print"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF Kartu</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* QR presensi siswa: SVG vektor dari server (bukan QR buatan klien) */}
      <Modal
        isOpen={qrTarget !== null}
        onClose={() => setQrTarget(null)}
        title={`QR Presensi: ${qrTarget?.name ?? ''}`}
        subtitle={
          qrTarget !== null
            ? `NISN ${qrTarget.nisn} — QR bertanda tangan server, bukan NISN mentah`
            : undefined
        }
        maxWidth="md"
        dataTestId="modal-kts-qr"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {qrModalState === 'loading' && (
              <p className="text-xs text-slate-500">Memuat QR vektor dari server…</p>
            )}
            {qrModalState === 'error' && (
              <p className="text-xs text-rose-700">
                QR gagal dimuat dari server. Pastikan sesi operator masih aktif lalu coba lagi.
              </p>
            )}
            {qrModalState === 'idle' && qrModalSvg !== '' && (
              <div
                className="w-56 h-56 bg-white p-2 rounded-xl border border-slate-200"
                data-testid="kts-qr-svg"
                dangerouslySetInnerHTML={{ __html: qrModalSvg }}
              />
            )}
            <p className="text-xs font-mono font-bold text-slate-700">
              NISN {qrTarget?.nisn ?? ''}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setQrTarget(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
