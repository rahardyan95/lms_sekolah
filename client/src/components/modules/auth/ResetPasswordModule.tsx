import React, { useState } from 'react';
import { KeyRound, Mail, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { AuthService } from '../../../services/AuthService';

interface ResetPasswordModuleProps {
  email: string;
  token: string;
  onSuccess: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

/**
 * Halaman /reset-password?token=...&email=... yang dibuka dari email.
 * Memvalidasi token via API lalu mengalihkan ke halaman login.
 */
export const ResetPasswordModule: React.FC<ResetPasswordModuleProps> = ({ email, token, onSuccess, onShowToast }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const invalidLink = !email || !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      onShowToast('Validasi Gagal', 'Kata sandi minimal 8 karakter.', 'error');
      return;
    }
    if (password !== confirm) {
      onShowToast('Validasi Gagal', 'Konfirmasi kata sandi tidak sama.', 'error');
      return;
    }
    setLoading(true);
    try {
      await AuthService.resetPassword(email, token, password);
      onShowToast('Kata Sandi Diubah', 'Silakan masuk dengan kata sandi baru.', 'success');
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      onShowToast('Reset Gagal', message || 'Tautan tidak valid. Ajukan reset ulang.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6" data-testid="reset-password-module">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-b from-teal-50/60 to-white border-b border-slate-100 text-center">
          <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-600/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Atur Ulang Kata Sandi</h2>
          <p className="text-xs text-slate-500 mt-1">Buat kata sandi baru untuk akun Anda</p>
        </div>

        <div className="p-6 sm:p-8">
          {invalidLink ? (
            <div className="text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Tautan reset tidak lengkap atau sudah tidak berlaku. Ajukan permintaan baru melalui halaman
                <strong> Lupa kata sandi</strong>.
              </p>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  Akun: <strong className="text-slate-800">{email}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi Baru</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-reset-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ulangi Kata Sandi Baru</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Ketik ulang kata sandi"
                    className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                    data-testid="input-reset-password-confirm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                data-testid="btn-reset-submit"
              >
                {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </button>

              <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Setelah berhasil, semua sesi lama otomatis berakhir.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
