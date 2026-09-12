import React, { useState, useEffect } from 'react';
import { SchoolConfig } from '../../../types';
import {
  Settings,
  Building,
  Mail,
  MessageSquare,
  Save,
  Server,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { addAuditLog } from '../../../utils/helpers';
import { SettingsApiService } from '../../../services/OpsApiService';
import { TokenStorage } from '../../../services/TokenStorage';

interface SettingsModuleProps {
  config: SchoolConfig;
  onSaveConfig: (updated: SchoolConfig) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

/** Kunci yang boleh ditulis (selaras SettingsService::ALLOWED_KEYS di backend). */
const IDENTITY_KEYS = ['school_name', 'npsn', 'address', 'phone', 'email', 'logo_url', 'favicon_url', 'school_wa_number'];
const WA_KEYS = ['wa_provider', 'wa_endpoint', 'wa_sender'];
const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'];
const FLAG_KEYS = ['retention_months', 'timezone', 'late_after'];
/** Rahasia: tidak pernah dimuat balik dari server (server memask), kirim bila diisi. */
const SECRET_KEYS = ['wa_api_key', 'smtp_password'];

const PERSISTED_KEYS = [...IDENTITY_KEYS, ...WA_KEYS, ...SMTP_KEYS, ...FLAG_KEYS];

/** Pemetaan key server → SchoolConfig agar landing page ikut terbarui. */
const CONFIG_MAP: Array<{ key: string; toConfig: (c: SchoolConfig, v: string) => SchoolConfig }> = [
  { key: 'school_name', toConfig: (c, v) => ({ ...c, name: v }) },
  { key: 'npsn', toConfig: (c, v) => ({ ...c, npsn: v }) },
  { key: 'address', toConfig: (c, v) => ({ ...c, address: v }) },
  { key: 'phone', toConfig: (c, v) => ({ ...c, phone: v }) },
  { key: 'email', toConfig: (c, v) => ({ ...c, email: v }) },
  { key: 'wa_sender', toConfig: (c, v) => ({ ...c, waSenderNumber: v }) },
  { key: 'smtp_host', toConfig: (c, v) => ({ ...c, smtpHost: v }) },
  { key: 'smtp_port', toConfig: (c, v) => ({ ...c, smtpPort: parseInt(v, 10) || c.smtpPort }) },
];

const inputClass =
  'w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none';

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  config: initialConfig,
  onSaveConfig,
  onShowToast,
}) => {
  const [activeSection, setActiveSection] = useState<'identitas' | 'integrasi' | 'spmb'>('identitas');
  const [serverBacked, setServerBacked] = useState(false);
  const [versions, setVersions] = useState<Record<string, number>>({});
  // Nilai per-key server (string). Seed dari config lokal agar DEV tetap terisi.
  const [values, setValues] = useState<Record<string, string>>(() => ({
    school_name: initialConfig.name,
    npsn: initialConfig.npsn,
    address: initialConfig.address,
    phone: initialConfig.phone,
    email: initialConfig.email,
    wa_sender: initialConfig.waSenderNumber,
    wa_provider: initialConfig.waGatewayProvider,
    smtp_host: initialConfig.smtpHost,
    smtp_port: String(initialConfig.smtpPort),
    spmb_open: initialConfig.spmbActive ? '1' : '0',
    spmb_test_mode: '0',
    timezone: 'Asia/Jakarta',
    late_after: '07:00',
  }));
  // Rahasia tidak pernah diisi dari server — input selalu mulai kosong.
  const [secrets, setSecrets] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const isOn = (key: string) => values[key] === '1' || values[key] === 'true';

  // Server-first (super-admin): muat semua key allowlist dari API.
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void SettingsApiService.get()
      .then((kv) => {
        if (cancelled) return;
        setValues((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(kv)) {
            if (typeof v === 'string') next[k] = v;
          }
          return next;
        });
        setServerBacked(true);
      })
      .catch(() => {
        /* bukan super-admin / offline → mode lokal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (serverBacked) {
      try {
        const nextVersions: Record<string, number> = { ...versions };
        for (const key of PERSISTED_KEYS) {
          const res = await SettingsApiService.set(key, values[key] ?? '', versions[key]);
          nextVersions[key] = res.version;
        }
        for (const key of SECRET_KEYS) {
          if ((secrets[key] ?? '').trim() !== '') {
            await SettingsApiService.set(key, secrets[key]);
          }
        }
        setVersions(nextVersions);
        setSecrets({});
      } catch {
        onShowToast('Sinkron Server Gagal', 'Versi bentrok (409) atau bukan super-admin; tersimpan lokal.', 'warning');
      }
    }

    // Cermin ke state aplikasi (identitas sekolah, landing page) — bukan hardcoded.
    let nextConfig: SchoolConfig = { ...initialConfig, spmbActive: isOn('spmb_open') };
    for (const { key, toConfig } of CONFIG_MAP) {
      const v = values[key];
      if (typeof v === 'string' && v !== '') nextConfig = toConfig(nextConfig, v);
    }
    nextConfig = {
      ...nextConfig,
      waGatewayProvider: (values.wa_provider as SchoolConfig['waGatewayProvider']) || nextConfig.waGatewayProvider,
    };

    onSaveConfig(nextConfig);
    addAuditLog('SYSTEM_SETTINGS_UPDATE', `Pengaturan sistem & identitas sekolah (${nextConfig.name}) diperbarui`, 'Super Admin', 'super_admin');
    onShowToast('Pengaturan Berhasil Disimpan', 'Konfigurasi identitas sekolah dan integrasi sistem telah diperbarui.', 'success');
  };

  const textField = (key: string, label: string, opts: { mono?: boolean; hint?: string; span?: boolean } = {}) => (
    <div className={opts.span ? 'sm:col-span-2' : ''} key={key}>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor={`setting-${key}`}>{label}</label>
      <input
        id={`setting-${key}`}
        type="text"
        value={values[key] ?? ''}
        onChange={(e) => setValue(key, e.target.value)}
        data-testid={`input-setting-${key}`}
        className={`${inputClass} ${opts.mono ? 'font-mono' : ''}`}
      />
      {opts.hint && <p className="text-[11px] text-slate-500 mt-1">{opts.hint}</p>}
    </div>
  );

  const secretField = (key: string, label: string, opts: { span?: boolean; hint?: string } = {}) => (
    <div className={opts.span ? 'sm:col-span-2' : ''} key={key}>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor={`setting-${key}`}>{label}</label>
      <input
        id={`setting-${key}`}
        type="password"
        value={secrets[key] ?? ''}
        onChange={(e) => setSecrets((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder="Kosong = tidak diubah"
        autoComplete="new-password"
        data-testid={`input-setting-${key}`}
        className={`${inputClass} font-mono`}
      />
      {opts.hint && <p className="text-[11px] text-slate-500 mt-1">{opts.hint}</p>}
    </div>
  );

  const toggleField = (key: string, label: string, description: string) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200" key={key}>
      <div>
        <h4 className="text-xs font-bold text-slate-900">{label}</h4>
        <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn(key)}
        aria-label={label}
        data-testid={`toggle-setting-${key}`}
        onClick={() => setValue(key, isOn(key) ? '0' : '1')}
        className="focus:outline-none"
      >
        {isOn(key) ? (
          <ToggleRight className="w-9 h-9 text-teal-600 cursor-pointer" />
        ) : (
          <ToggleLeft className="w-9 h-9 text-slate-500 cursor-pointer" />
        )}
      </button>
    </div>
  );

  const sectionButton = (id: typeof activeSection, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveSection(id)}
      data-testid={`tab-settings-${id}`}
      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
        activeSection === id ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6" data-testid="settings-module">
      {serverBacked && (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2" role="status" data-testid="settings-server-badge">
          Tersambung ke server — perubahan tersimpan per-key berversi (konflik = 409, muat ulang dulu).
        </p>
      )}
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-600" />
            <span>Pengaturan Sistem & Integrasi Gateway</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi identitas resmi sekolah, WhatsApp Gateway API, server mailer SMTP, dan sakelar PPDB/SPMB
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {sectionButton('identitas', 'Identitas Sekolah')}
          {sectionButton('integrasi', 'Integrasi Gateway')}
          {sectionButton('spmb', 'Mode SPMB')}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        {/* SECTION 1: IDENTITAS SEKOLAH */}
        {activeSection === 'identitas' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-teal-600" />
              <span>Identitas Resmi Lembaga Pendidikan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {textField('school_name', 'Nama Resmi Sekolah')}
              {textField('npsn', 'Nomor Pokok Sekolah Nasional (NPSN)', { mono: true })}
              {textField('address', 'Alamat Lengkap', { span: true })}
              {textField('phone', 'Telepon Sekolah', { mono: true })}
              {textField('email', 'Email Sekolah')}
              {textField('school_wa_number', 'Nomor WhatsApp Sekolah', { mono: true, hint: 'Dipakai tombol kontak sekolah di portal orang tua.' })}
              {textField('logo_url', 'URL Logo Sekolah', { mono: true })}
              {textField('favicon_url', 'URL Favicon', { mono: true })}
            </div>
          </div>
        )}

        {/* SECTION 2: INTEGRASI GATEWAY & SMTP */}
        {activeSection === 'integrasi' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span>WhatsApp Notification Gateway</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="setting-wa_provider">Provider Gateway</label>
                  <select
                    id="setting-wa_provider"
                    value={values.wa_provider ?? ''}
                    onChange={(e) => setValue('wa_provider', e.target.value)}
                    data-testid="input-setting-wa_provider"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold"
                  >
                    <option value="log">Log (dev-safe)</option>
                    <option value="Fonnte">Fonnte Gateway</option>
                    <option value="Wablas">Wablas Engine</option>
                    <option value="Custom API">Custom API Webhook</option>
                  </select>
                </div>
                {textField('wa_sender', 'Nomor Pengirim (Device Number)', { mono: true })}
                {textField('wa_endpoint', 'URL Endpoint Gateway', { mono: true, span: true })}
                {secretField('wa_api_key', 'API Key / Token Rahasia (tidak pernah ditampilkan kembali)', { span: true })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {toggleField('wa_notify_attendance', 'Notifikasi Presensi', 'Kirim pesan WhatsApp ke orang tua setiap pemindaian presensi.')}
                {toggleField('wa_notify_otp', 'Verifikasi OTP WhatsApp', 'Kirim kode OTP 6-digit untuk login portal orang tua.')}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Mail className="w-4 h-4 text-teal-600" />
                <span>Konfigurasi Email SMTP Server</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {textField('smtp_host', 'Host Server SMTP', { mono: true, span: true })}
                {textField('smtp_port', 'Port SMTP', { mono: true })}
                {textField('smtp_user', 'Username SMTP', { mono: true })}
                {textField('smtp_from', 'Alamat Pengirim (From)', { mono: true })}
                {secretField('smtp_password', 'Kata Sandi SMTP (tidak pernah ditampilkan kembali)', { span: true })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: MODE SPMB */}
        {activeSection === 'spmb' && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Server className="w-4 h-4 text-teal-600" />
              <span>Pengaturan Pendaftaran SPMB / PPDB Online</span>
            </h3>

            {toggleField('spmb_open', 'Sakelar Buka / Tutup Pendaftaran SPMB', 'Jika dinonaktifkan, formulir pendaftaran online ditutup untuk calon siswa publik.')}
            {toggleField('spmb_test_mode', 'Mode Pengujian Admin', 'Panitia (super-admin/admin TU) tetap bisa mensubmit saat SPMB tutup; pendaftaran ditandai [TEST] dan dicatat di audit log.')}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {textField('retention_months', 'Retensi Data (bulan)', { mono: true })}
              {textField('timezone', 'Zona Waktu', { mono: true })}
              {textField('late_after', 'Batas Jam Terlambat (HH:MM)', { mono: true })}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
            data-testid="btn-save-settings"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Seluruh Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
