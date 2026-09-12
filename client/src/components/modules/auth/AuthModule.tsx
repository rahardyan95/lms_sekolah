import React, { useState, useEffect } from 'react';
import { UserRole } from '../../../types';
import {
  Lock,
  Mail,
  User,
  Calendar,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';
import { AuthService } from '../../../services/AuthService';
import type { DemoCredential } from '../../../data/DemoAccounts';

/**
 * Katalog akun demo hanya dimuat saat DEV. Cabang ini di-fold saat build
 * (import.meta.env.DEV → false), sehingga berkas kredensial demo tidak pernah
 * ikut ke bundle produksi — sama seperti pola MOCKS di App.tsx.
 */
const loadDemoAccounts = import.meta.env.DEV
  ? () => import('../../../data/DemoAccounts').then((m) => m.DemoAccounts.all())
  : null;

interface AuthModuleProps {
  onLoginSuccess: (role: UserRole, identifier: string) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const AuthModule: React.FC<AuthModuleProps> = ({ onLoginSuccess, onShowToast }) => {
  // Kredensial demo dimuat asinkron hanya di DEV (chunk terpisah).
  const [demoCredentials, setDemoCredentials] = useState<DemoCredential[]>([]);

  useEffect(() => {
    if (!loadDemoAccounts) return;
    let cancelled = false;
    void loadDemoAccounts().then((list) => {
      if (!cancelled) setDemoCredentials(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Artefak demo TIDAK boleh ke production: kredensial terisi & fallback mock
  // hanya saat Vite DEV. Produksi: form kosong + tanpa bypass offline.
  const isDev = import.meta.env.DEV;
  const [activeTab, setActiveTab] = useState<'staff' | 'siswa' | 'orang_tua' | 'spmb'>('staff');

  // Staff form state
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Student form state
  const [studentNisn, setStudentNisn] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Parent form state
  const [parentNisn, setParentNisn] = useState('');
  const [parentDob, setParentDob] = useState('');
  const [useOtp, setUseOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(60);

  // SPMB Candidate form state
  const [spmbRegNo, setSpmbRegNo] = useState('');
  const [spmbPassword, setSpmbPassword] = useState('');
  const [showSpmbPassword, setShowSpmbPassword] = useState(false);

  // Forgot Password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Handle Staff Login — role SELALU dari server (portal/roles), bukan pilihan form.
  const loginStaff = async (identifier: string, password: string) => {
    if (!identifier || !password) {
      onShowToast('Validasi Gagal', 'Email dan password wajib diisi.', 'error');
      return;
    }
    try {
      const { role } = await AuthService.login(identifier, password);
      addAuditLog('AUTH_LOGIN_STAFF', `Staff login via API sebagai ${role} (${identifier})`, identifier, role);
      onShowToast('Login Berhasil', `Selamat datang di Portal ${role.toUpperCase().replace('_', ' ')}`, 'success');
      onLoginSuccess(role, identifier);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'API_OFFLINE' && isDev) {
        addAuditLog('AUTH_LOGIN_STAFF_DEMO', `Demo login (DEV) sebagai admin_tu (${identifier})`, identifier, 'admin_tu');
        onShowToast('Mode Demo (DEV)', 'API offline — masuk demo lokal sebagai Admin/TU.', 'warning');
        onLoginSuccess('admin_tu', identifier);
        return;
      }
      addAuditLog('AUTH_LOGIN_STAFF_FAILED', `Login staff gagal (${identifier})`, identifier, 'guest');
      onShowToast('Login Gagal', message && message !== 'API_OFFLINE' ? message : 'Kredensial tidak valid atau akun tidak aktif.', 'error');
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loginStaff(staffEmail, staffPassword);
  };

  // Handle Student Login
  const loginStudent = async (nisn: string, password: string) => {
    if (!nisn || !password) {
      onShowToast('Validasi Gagal', 'NISN dan password wajib diisi.', 'error');
      return;
    }
    try {
      const { role } = await AuthService.login(nisn, password);
      addAuditLog('AUTH_LOGIN_SISWA', `Siswa login via API dengan NISN ${nisn}`, nisn, role);
      onShowToast('Login Siswa Berhasil', 'Memasuki Dashboard Pembelajaran & LMS Siswa', 'success');
      onLoginSuccess(role, nisn);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'API_OFFLINE' && isDev) {
        addAuditLog('AUTH_LOGIN_SISWA_DEMO', `Demo login siswa (DEV) NISN ${nisn}`, nisn, 'siswa');
        onShowToast('Mode Demo (DEV)', 'API offline — masuk demo lokal sebagai Siswa.', 'warning');
        onLoginSuccess('siswa', nisn);
        return;
      }
      addAuditLog('AUTH_LOGIN_SISWA_FAILED', `Login siswa gagal (NISN ${nisn})`, nisn, 'guest');
      onShowToast('Login Gagal', message && message !== 'API_OFFLINE' ? message : 'NISN atau kata sandi salah.', 'error');
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loginStudent(studentNisn, studentPassword);
  };

  // Handle Parent Login
  const loginParent = async (nisn: string, dob: string, otp?: string) => {
    if (!nisn || !dob) {
      onShowToast('Validasi Gagal', 'NISN Anak dan Tanggal Lahir wajib diisi.', 'error');
      return;
    }
    if (otp !== undefined) {
      try {
        const ok = await AuthService.verifyOtp(nisn, otp);
        if (!ok) {
          onShowToast('OTP Tidak Valid', 'Kode OTP 6-digit salah atau kedaluwarsa.', 'error');
          return;
        }
      } catch {
        onShowToast('OTP Tidak Valid', 'Kode OTP 6-digit salah atau kedaluwarsa. Minta kode baru via WhatsApp.', 'error');
        return;
      }
    }
    addAuditLog('AUTH_LOGIN_ORANG_TUA', `Orang Tua login untuk NISN anak ${nisn}`, `Ortu-${nisn}`, 'orang_tua');
    onShowToast('Login Orang Tua Berhasil', 'Memasuki Portal Monitoring Akademik & Kehadiran Anak', 'success');
    onLoginSuccess('orang_tua', nisn);
  };

  const handleParentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loginParent(parentNisn, parentDob, useOtp ? otpCode : undefined);
  };

  // Trigger Send OTP — via server (Fonnte). debug_code hanya di DEV.
  const handleSendOtp = async () => {
    try {
      const debugCode = await AuthService.requestOtp(parentNisn);
      setOtpSent(true);
      setOtpCode(debugCode ?? '');
      onShowToast('OTP Terkirim', 'Kode OTP dikirim via WhatsApp. Berlaku 5 menit, sekali pakai.', 'info');
    } catch {
      onShowToast('OTP Gagal', 'Server tidak merespons. Periksa koneksi dan coba lagi.', 'error');
    }
  };

  // Handle SPMB Candidate Login
  const loginSpmb = async (regNo: string, password: string) => {
    if (!regNo || !password) {
      onShowToast('Validasi Gagal', 'Nomor Pendaftaran dan password wajib diisi.', 'error');
      return;
    }
    try {
      const { role } = await AuthService.login(regNo, password);
      addAuditLog('AUTH_LOGIN_SPMB', `Calon siswa login via API (${regNo})`, regNo, role);
      onShowToast('Login Calon Siswa Berhasil', 'Memasuki Portal Pendaftaran Murid Baru (SPMB)', 'success');
      onLoginSuccess(role, regNo);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'API_OFFLINE' && isDev) {
        addAuditLog('AUTH_LOGIN_SPMB_DEMO', `Demo login SPMB (DEV) (${regNo})`, regNo, 'calon_siswa');
        onShowToast('Mode Demo (DEV)', 'API offline — masuk demo lokal sebagai Calon Siswa.', 'warning');
        onLoginSuccess('calon_siswa', regNo);
        return;
      }
      addAuditLog('AUTH_LOGIN_SPMB_FAILED', `Login SPMB gagal (${regNo})`, regNo, 'guest');
      onShowToast('Login Gagal', message && message !== 'API_OFFLINE' ? message : 'Nomor pendaftaran atau kata sandi salah.', 'error');
    }
  };

  const handleSpmbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loginSpmb(spmbRegNo, spmbPassword);
  };

  /**
   * Isi otomatis + langsung masuk sebagai akun demo (DEV only): satu klik per
   * peran agar seluruh 8 role cepat diuji tanpa mengetik kredensial.
   */
  const handleDemoLogin = async (cred: DemoCredential) => {
    setActiveTab(cred.tab);

    if (cred.tab === 'staff') {
      setStaffEmail(cred.identifier);
      setStaffPassword(cred.password);
      await loginStaff(cred.identifier, cred.password);
      return;
    }

    if (cred.tab === 'siswa') {
      setStudentNisn(cred.identifier);
      setStudentPassword(cred.password);
      await loginStudent(cred.identifier, cred.password);
      return;
    }

    if (cred.tab === 'spmb') {
      setSpmbRegNo(cred.identifier);
      setSpmbPassword(cred.password);
      await loginSpmb(cred.identifier, cred.password);
      return;
    }

    // Orang tua: NISN + tanggal lahir anak, lalu verifikasi OTP WhatsApp
    // sungguhan (kode debug hanya dikembalikan server non-production).
    const dob = cred.birthDate ?? '';
    setParentNisn(cred.identifier);
    setParentDob(dob);
    setUseOtp(true);

    try {
      const code = await AuthService.requestOtp(cred.identifier);
      setOtpSent(true);
      setOtpCode(code ?? '');
      await loginParent(cred.identifier, dob, code ?? undefined);
    } catch {
      onShowToast('Demo Orang Tua Gagal', 'OTP tidak dapat dikirim. Isi form manual atau coba lagi.', 'error');
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
    addAuditLog('AUTH_PASSWORD_RESET_REQ', `Permintaan reset kata sandi diajukan untuk ${forgotEmail}`, forgotEmail, 'guest');
    onShowToast('Tautan Terkirim', `Tautan pemulihan kata sandi telah dikirim ke ${forgotEmail}`, 'success');
    setTimeout(() => {
      setIsForgotModalOpen(false);
      setForgotSent(false);
      setForgotEmail('');
    }, 2000);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6" data-testid="auth-module">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Branding */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-teal-50/60 to-white border-b border-slate-100 text-center">
          <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-600/20">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Portal Masuk SIAKAD & LMS
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            SMK Negeri 1 Jakarta — Sistem Informasi Akademik Terpadu
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-4 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('staff')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'staff'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-login-staff"
          >
            Staff / Guru
          </button>
          <button
            onClick={() => setActiveTab('siswa')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'siswa'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-login-siswa"
          >
            Siswa
          </button>
          <button
            onClick={() => setActiveTab('orang_tua')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'orang_tua'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-login-ortu"
          >
            Orang Tua
          </button>
          <button
            onClick={() => setActiveTab('spmb')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'spmb'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-login-spmb"
          >
            PPDB / SPMB
          </button>
        </div>

        {/* Akun Demo (DEV only): satu klik per peran untuk uji cepat 8 role.
            Tidak pernah masuk bundle produksi (import.meta.env.DEV di-fold). */}
        {isDev && demoCredentials.length > 0 && (
          <div className="px-4 sm:px-6 py-4 bg-amber-50/70 border-b border-amber-200" data-testid="demo-accounts-panel">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Akun Demo (DEV) — klik untuk masuk langsung
              </span>
              <span className="text-[10px] text-amber-700 font-mono">sandi: {demoCredentials[0].password}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => void handleDemoLogin(cred)}
                  title={`${cred.identifier} → ${cred.portal}`}
                  className="px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-colors truncate"
                  data-testid={`btn-demo-${cred.role}`}
                >
                  {cred.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Forms Container */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: STAFF / GURU / ADMIN */}
          {activeTab === 'staff' && (
            <form onSubmit={handleStaffSubmit} className="space-y-4" data-testid="form-staff-login">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Peran portal ditentukan server dari akun Anda — bukan dari pilihan form.
              </div>

              <div>
                <label htmlFor="auth-staff-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Email Resmi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-staff-email"
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                    placeholder="nama@smkn1jakarta.sch.id"
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-staff-email"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="auth-staff-password" className="text-xs font-semibold text-slate-700">Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[11px] text-teal-600 hover:text-teal-700 hover:underline font-medium"
                    data-testid="forgot-password-link"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-staff-password"
                    type={showStaffPassword ? 'text' : 'password'}
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    required
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-staff-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
                data-testid="btn-staff-submit"
              >
                <span>Masuk Portal Staff</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2: SISWA (NISN) */}
          {activeTab === 'siswa' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4" data-testid="form-student-login">
              <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex items-start gap-2.5 text-xs text-teal-800">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Siswa masuk menggunakan 10-digit <strong>Nomor Induk Siswa Nasional (NISN)</strong> dan kata sandi akun sekolah.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor Induk Siswa Nasional (NISN)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentNisn}
                    onChange={(e) => setStudentNisn(e.target.value)}
                    required
                    maxLength={10}
                    placeholder="Contoh: 0071829384"
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                    data-testid="input-student-nisn"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Kata Sandi Siswa</label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[11px] text-teal-600 hover:text-teal-700 hover:underline font-medium"
                  >
                    Bantuan sandi?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    required
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-student-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
                data-testid="btn-student-submit"
              >
                <span>Masuk Portal Siswa (LMS)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 3: ORANG TUA (NISN + TANGGAL LAHIR + OTP) */}
          {activeTab === 'orang_tua' && (
            <form onSubmit={handleParentSubmit} className="space-y-4" data-testid="form-parent-login">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Login Instan: Masukkan NISN dan Tanggal Lahir anak yang terdaftar untuk memantau nilai, presensi, dan tagihan SPP.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  NISN Putra / Putri Anda
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={parentNisn}
                    onChange={(e) => setParentNisn(e.target.value)}
                    required
                    placeholder="Contoh: 0071829384"
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                    data-testid="input-parent-nisn"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal Lahir Siswa
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={parentDob}
                    onChange={(e) => setParentDob(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-parent-dob"
                  />
                </div>
              </div>

              {/* Optional WhatsApp OTP Toggle */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOtp}
                    onChange={(e) => setUseOtp(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                    data-testid="checkbox-use-otp"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Gunakan Verifikasi OTP WhatsApp (Keamanan Tambahan)
                  </span>
                </label>
              </div>

              {useOtp && (
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-900">Kode OTP 6-Digit</span>
                    {!otpSent ? (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-800 underline"
                        data-testid="btn-request-otp"
                      >
                        Kirim OTP ke WA
                      </button>
                    ) : (
                      <span className="text-[11px] text-teal-700 font-mono" data-testid="otp-sent-badge">OTP Terkirim via WhatsApp</span>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Masukkan 6 digit OTP"
                    className="w-full px-3.5 py-2 text-xs text-center font-mono tracking-widest rounded-lg border border-teal-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                    data-testid="input-parent-otp"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
                data-testid="btn-parent-submit"
              >
                <span>Masuk Portal Orang Tua</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 4: CALON SISWA (SPMB) */}
          {activeTab === 'spmb' && (
            <form onSubmit={handleSpmbSubmit} className="space-y-4" data-testid="form-spmb-login">
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
                Penerimaan Peserta Didik Baru (PPDB Online): Masuk menggunakan Nomor Pendaftaran SPMB untuk memeriksa status seleksi atau melengkapi berkas.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nomor Pendaftaran SPMB
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={spmbRegNo}
                    onChange={(e) => setSpmbRegNo(e.target.value)}
                    required
                    placeholder="Contoh: SPMB-2026-0089"
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                    data-testid="input-spmb-regno"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi Akun Pendaftaran
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showSpmbPassword ? 'text' : 'password'}
                    value={spmbPassword}
                    onChange={(e) => setSpmbPassword(e.target.value)}
                    required
                    placeholder="Masukkan kata sandi saat mendaftar"
                    className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-spmb-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSpmbPassword(!showSpmbPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showSpmbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
                data-testid="btn-spmb-submit"
              >
                <span>Masuk Portal Pendaftaran SPMB</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
          Butuh bantuan akses akun? Hubungi Tim IT / Helpdesk di <strong>(021) 3840284</strong> atau WhatsApp Center.
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Pemulihan Kata Sandi"
        subtitle="Masukkan alamat email atau NISN terdaftar untuk menerima tautan reset kata sandi"
        maxWidth="md"
        dataTestId="forgot-password-modal"
      >
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          {forgotSent ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Tautan Pemulihan Berhasil Dikirim</p>
                <p className="mt-1">
                  Silakan periksa kotak masuk atau spam email Anda untuk petunjuk penyetelan ulang kata sandi.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Akun Terdaftar
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="admin@smkn1jakarta.sch.id"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                  data-testid="input-forgot-email"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
                  data-testid="btn-submit-forgot"
                >
                  Kirim Tautan Reset
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
};
