import React, { useState } from 'react';
import { SchoolConfig } from '../../../types';
import {
  MessageSquare,
  Send,
  Radio,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  Sliders,
  Users,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { addAuditLog } from '../../../utils/helpers';

interface WhatsAppBroadcastLog {
  id: string;
  recipientGroup: string;
  totalRecipients: number;
  messagePreview: string;
  sentAt: string;
  status: 'Terkirim' | 'Sebagian Terkirim' | 'Gagal';
  deliveredCount: number;
}

interface WhatsAppModuleProps {
  schoolConfig: SchoolConfig;
  onUpdateConfig: (config: SchoolConfig) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({
  schoolConfig,
  onUpdateConfig,
  onShowToast,
}) => {
  const [provider, setProvider] = useState<'Fonnte' | 'Wablas' | 'Custom API'>(
    schoolConfig.waGatewayProvider || 'Fonnte'
  );
  const [apiKey, setApiKey] = useState(schoolConfig.waApiKey || 'fn_live_89127391823901238912');
  const [senderNumber, setSenderNumber] = useState(schoolConfig.waSenderNumber || '081298765432');
  const [isGatewayActive, setIsGatewayActive] = useState(schoolConfig.waActive ?? true);

  // Broadcast Manager State
  const [broadcastTarget, setBroadcastTarget] = useState<'Semua Orang Tua' | 'Semua Siswa' | 'Semua Guru'>('Semua Orang Tua');
  const [broadcastTemplate, setBroadcastTemplate] = useState(
    'Yth. Bapak/Ibu Orang Tua dari {nama_siswa} ({kelas}), kami informasikan bahwa Penilaian Tengah Semester (PTS) akan dimulai pada tanggal 14 September 2026. Mohon bimbingan belajar putra/putri di rumah. Terima kasih.'
  );
  const [isSending, setIsSending] = useState(false);

  // Broadcast History Logs
  const [broadcastLogs, setBroadcastLogs] = useState<WhatsAppBroadcastLog[]>([
    {
      id: 'WB-001',
      recipientGroup: 'Semua Orang Tua (Kelas X)',
      totalRecipients: 72,
      deliveredCount: 72,
      messagePreview: 'Pemberitahuan Jadwal PTS Ganjil 2026/2027...',
      sentAt: '2026-09-08 07:30',
      status: 'Terkirim',
    },
    {
      id: 'WB-002',
      recipientGroup: 'Semua Guru Pengampu',
      totalRecipients: 45,
      deliveredCount: 44,
      messagePreview: 'Batas akhir pengunggahan nilai formatif 1 pada sistem...',
      sentAt: '2026-09-04 09:15',
      status: 'Terkirim',
    },
    {
      id: 'WB-003',
      recipientGroup: 'Semua Siswa SMK',
      totalRecipients: 720,
      deliveredCount: 715,
      messagePreview: 'Pengumuman Ujian CBT dan Kartu Peserta Ujian...',
      sentAt: '2026-08-28 14:00',
      status: 'Terkirim',
    },
  ]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      ...schoolConfig,
      waGatewayProvider: provider,
      waApiKey: apiKey,
      waSenderNumber: senderNumber,
      waActive: isGatewayActive,
    });
    addAuditLog('WA_GATEWAY_CONFIG', `Konfigurasi WA Gateway diubah: Provider ${provider}, Status: ${isGatewayActive ? 'Aktif' : 'Nonaktif'}`, 'Admin', 'admin_tu');
    onShowToast('Pengaturan Disimpan', 'Konfigurasi WhatsApp Gateway berhasil diperbarui.', 'success');
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTemplate.trim()) {
      onShowToast('Pesan Kosong', 'Tulis pesan yang akan disiarkan terlebih dahulu.', 'error');
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const recipientCount = broadcastTarget === 'Semua Orang Tua' ? 360 : broadcastTarget === 'Semua Siswa' ? 360 : 45;

      const newLog: WhatsAppBroadcastLog = {
        id: `WB-${Date.now().toString().slice(-4)}`,
        recipientGroup: broadcastTarget,
        totalRecipients: recipientCount,
        deliveredCount: recipientCount,
        messagePreview: broadcastTemplate.slice(0, 60) + '...',
        sentAt: timeStr,
        status: 'Terkirim',
      };

      setBroadcastLogs([newLog, ...broadcastLogs]);
      addAuditLog('WA_BROADCAST_SENT', `Siaran WA dikirim ke ${broadcastTarget} (${recipientCount} penerima)`, 'Admin Humas', 'admin_tu');
      onShowToast('Siaran WhatsApp Terkirim', `Berhasil mengirimkan pesan massal ke ${recipientCount} nomor ${broadcastTarget}.`, 'success');
    }, 1200);
  };

  return (
    <div className="space-y-6" data-testid="whatsapp-module">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <span>Integrasi WhatsApp Gateway & Notifikasi Otomatis</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan multi-provider gateway (Fonnte, Wablas, Custom API) dan penyiaran pesan massal resmi sekolah
          </p>
        </div>

        {/* Live Service Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>Layanan Gateway: {isGatewayActive ? 'ONLINE & SIAP' : 'NONAKTIF'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Gateway Settings */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span>Konfigurasi Provider</span>
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGatewayActive}
                  onChange={(e) => setIsGatewayActive(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-semibold text-slate-700">Aktif</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Provider WhatsApp
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
              >
                <option value="Fonnte">Fonnte (Official Cloud Gateway)</option>
                <option value="Wablas">Wablas (Multi-Device Engine)</option>
                <option value="Custom API">Custom REST API Gateway</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                API Key / Token Otentikasi
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Pengirim (Device Number)
              </label>
              <input
                type="text"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Feature switches */}
            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
              <p className="font-bold text-slate-700">Triggers Notifikasi Otomatis:</p>
              <div className="space-y-1.5 text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                  <span>Notifikasi Presensi Masuk / Pulang Siswa</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                  <span>Notifikasi Keterlambatan Siswa ke Orang Tua</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                  <span>Kirim Kwitansi Pembayaran SPP Resmi</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded text-teal-600" />
                  <span>Kode OTP Verifikasi Masuk Portal</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Simpan Konfigurasi Gateway
            </button>
          </form>
        </div>

        {/* RIGHT: Broadcast Manager & Delivery Logs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Broadcast Composer */}
          <form onSubmit={handleSendBroadcast} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-600" />
                <span>Kirim Siaran Massal (WhatsApp Broadcast)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Log Tersimpan</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Penerima</label>
              <select
                value={broadcastTarget}
                onChange={(e) => setBroadcastTarget(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="Semua Orang Tua">Semua Orang Tua / Wali Murid (Aktif)</option>
                <option value="Semua Siswa">Seluruh Siswa Terdaftar</option>
                <option value="Semua Guru">Dewan Guru & Tenaga Kependidikan</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Isi Pesan Pengumuman</label>
                <div className="flex gap-1.5 text-[10px] text-teal-700 font-mono">
                  <span className="px-1.5 py-0.5 bg-teal-50 rounded border border-teal-200 cursor-pointer">
                    {'{nama_siswa}'}
                  </span>
                  <span className="px-1.5 py-0.5 bg-teal-50 rounded border border-teal-200 cursor-pointer">
                    {'{kelas}'}
                  </span>
                </div>
              </div>
              <textarea
                value={broadcastTemplate}
                onChange={(e) => setBroadcastTemplate(e.target.value)}
                rows={4}
                required
                className="w-full p-3 text-xs rounded-xl border border-slate-200 font-sans text-slate-800 focus:ring-2 focus:ring-teal-500 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirimkan Siaran Massal...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Broadcast Sekarang</span>
                </>
              )}
            </button>
          </form>

          {/* Delivery Logs Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Log Pengiriman Siaran Massal</span>
            </span>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Ringkasan Pesan</th>
                    <th className="p-3 text-right">Terkirim</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {broadcastLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">{log.sentAt}</td>
                      <td className="p-3 font-bold text-slate-800">{log.recipientGroup}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{log.messagePreview}</td>
                      <td className="p-3 text-right font-mono text-slate-700 font-semibold">
                        {log.deliveredCount}/{log.totalRecipients}
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant="success">{log.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
