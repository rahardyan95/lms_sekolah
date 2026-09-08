import React, { useState } from 'react';
import { SchoolConfig } from '../../../types';
import {
  Settings,
  Building,
  Mail,
  MessageSquare,
  Shield,
  Save,
  Server,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
} from 'lucide-react';
import { addAuditLog } from '../../../utils/helpers';

interface SettingsModuleProps {
  config: SchoolConfig;
  onSaveConfig: (updated: SchoolConfig) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  config: initialConfig,
  onSaveConfig,
  onShowToast,
}) => {
  const [formData, setFormData] = useState<SchoolConfig>(initialConfig);
  const [activeSection, setActiveSection] = useState<'identitas' | 'integrasi' | 'spmb'>('identitas');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    addAuditLog('SYSTEM_SETTINGS_UPDATE', `Pengaturan sistem & identitas sekolah (${formData.name}) diperbarui`, 'Super Admin', 'super_admin');
    onShowToast('Pengaturan Berhasil Disimpan', 'Konfigurasi identitas sekolah dan integrasi sistem telah diperbarui.', 'success');
  };

  return (
    <div className="space-y-6" data-testid="settings-module">
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

        {/* Section switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSection('identitas')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSection === 'identitas'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Identitas Sekolah
          </button>
          <button
            onClick={() => setActiveSection('integrasi')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSection === 'integrasi'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Integrasi Gateway
          </button>
          <button
            onClick={() => setActiveSection('spmb')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeSection === 'spmb'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mode SPMB
          </button>
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Resmi Sekolah</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor Pokok Sekolah Nasional (NPSN)</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status Akreditasi</label>
                <input
                  type="text"
                  value={formData.akreditasi}
                  onChange={(e) => setFormData({ ...formData, akreditasi: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tahun Ajaran Aktif</label>
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Alamat Lengkap</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={formData.headmaster}
                  onChange={(e) => setFormData({ ...formData, headmaster: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={formData.headmasterNip}
                  onChange={(e) => setFormData({ ...formData, headmasterNip: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: INTEGRASI GATEWAY & SMTP */}
        {activeSection === 'integrasi' && (
          <div className="space-y-6 animate-fadeIn">
            {/* WhatsApp Config */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                <span>WhatsApp Notification Gateway</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Provider Gateway</label>
                  <select
                    value={formData.waGatewayProvider}
                    onChange={(e) => setFormData({ ...formData, waGatewayProvider: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold"
                  >
                    <option value="Fonnte">Fonnte Gateway</option>
                    <option value="Wablas">Wablas Engine</option>
                    <option value="Custom API">Custom API Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nomor Pengirim (Device Number)</label>
                  <input
                    type="text"
                    value={formData.waSenderNumber}
                    onChange={(e) => setFormData({ ...formData, waSenderNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">API Key / Token Rahasia</label>
                  <input
                    type="password"
                    value={formData.waApiKey}
                    onChange={(e) => setFormData({ ...formData, waApiKey: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* SMTP Mailer Config */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Mail className="w-4 h-4 text-teal-600" />
                <span>Konfigurasi Email SMTP Server</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Host Server SMTP</label>
                  <input
                    type="text"
                    value={formData.smtpHost}
                    onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Port SMTP</label>
                  <input
                    type="number"
                    value={formData.smtpPort}
                    onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value, 10) || 587 })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  />
                </div>
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

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Sakelar Buka / Tutup Pendaftaran SPMB</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Jika dinonaktifkan, formulir pendaftaran online akan ditutup untuk calon siswa publik.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, spmbActive: !formData.spmbActive })}
                  className="focus:outline-none"
                >
                  {formData.spmbActive ? (
                    <ToggleRight className="w-9 h-9 text-teal-600 cursor-pointer" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-400 cursor-pointer" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
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
