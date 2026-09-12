import React, { useState, useEffect } from 'react';
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
import { Modal } from '../../common/Modal';
import { addAuditLog } from '../../../utils/helpers';
import { BroadcastApiService, NotificationApiService, type ServerBroadcastLog, type ServerNotificationLog } from '../../../services/OpsApiService';
import { TokenStorage } from '../../../services/TokenStorage';

const TARGET_TO_AUDIENCE = {
  'Semua Orang Tua': 'orang_tua',
  'Semua Siswa': 'siswa',
  'Semua Guru': 'guru',
} as const;

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
  // Secret TIDAK pernah di-preload dari server (masked). Form mulai kosong:
  // kosong = tidak diubah. Provider default ikut DEC-001 (Fonnte primary).
  const [apiKey, setApiKey] = useState('');
  const [senderNumber, setSenderNumber] = useState(schoolConfig.waSenderNumber || '');
  const [isGatewayActive, setIsGatewayActive] = useState(schoolConfig.waActive ?? true);

  // Broadcast Manager State
  const [broadcastTarget, setBroadcastTarget] = useState<'Semua Orang Tua' | 'Semua Siswa' | 'Semua Guru'>('Semua Orang Tua');
  const [broadcastTemplate, setBroadcastTemplate] = useState(
    'Yth. Bapak/Ibu Orang Tua dari {nama_siswa} ({kelas}), kami informasikan bahwa Penilaian Tengah Semester (PTS) akan dimulai pada tanggal 14 September 2026. Mohon bimbingan belajar putra/putri di rumah. Terima kasih.'
  );
  const [isSending, setIsSending] = useState(false);

  // Delivery log viewer + gateway connectivity test.
  const [logModalBroadcast, setLogModalBroadcast] = useState<WhatsAppBroadcastLog | null>(null);
  const [logRows, setLogRows] = useState<ServerBroadcastLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Dead-letter view: log notifikasi (WA) beserta tombol kirim ulang.
  const [notificationLogs, setNotificationLogs] = useState<ServerNotificationLog[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<'' | ServerNotificationLog['status']>('');
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

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

  // Server-first: riwayat broadcast nyata bila login panitia.
  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void BroadcastApiService.list()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setBroadcastLogs(
          list.map((b) => ({
            id: b.id,
            recipientGroup: `Server: ${b.audience}`,
            totalRecipients: b.logs_count ?? 0,
            deliveredCount: b.logs_count ?? 0,
            messagePreview: `${b.title} — ${b.body.slice(0, 60)}...`,
            sentAt: String(b.created_at).slice(0, 16).replace('T', ' '),
            status: b.status === 'sent' ? 'Terkirim' : 'Sebagian Terkirim',
          }))
        );
      })
      .catch(() => {
        /* offline → mock */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dead-letter view dimuat saat modul dibuka (hanya bila ada sesi server).
  useEffect(() => {
    void loadNotifications('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenLogs = async (log: WhatsAppBroadcastLog) => {
    setLogModalBroadcast(log);
    setLogRows([]);
    // Log per-penerima hanya tersedia di server (login panitia).
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Login sebagai panitia untuk melihat log pengiriman.', 'error');
      return;
    }
    setIsLoadingLogs(true);
    try {
      setLogRows(await BroadcastApiService.logs(log.id));
    } catch {
      onShowToast('Log Tidak Tersedia', 'Server tidak merespons permintaan log siaran.', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Dead-letter: muat log notifikasi server (WA) sesuai filter status.
  const loadNotifications = async (status: '' | ServerNotificationLog['status']) => {
    if (!TokenStorage.hasSession()) return;
    setIsLoadingNotifications(true);
    try {
      setNotificationLogs(await NotificationApiService.list(status || undefined));
    } catch {
      onShowToast('Log Notifikasi Gagal', 'Server tidak merespons permintaan log notifikasi.', 'error');
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleRetryNotification = async (id: string) => {
    try {
      await NotificationApiService.retry(id);
      onShowToast('Kirim Ulang Dijadwalkan', 'Notifikasi dimasukkan kembali ke antrean pengiriman.', 'success');
      await loadNotifications(notificationFilter);
    } catch {
      onShowToast('Kirim Ulang Gagal', 'Server menolak permintaan kirim ulang.', 'error');
    }
  };

  const handleTestMessage = async () => {
    const phone = testPhone.trim();
    if (!phone) {
      onShowToast('Nomor Kosong', 'Masukkan nomor WhatsApp tujuan uji koneksi.', 'error');
      return;
    }
    if (!TokenStorage.hasSession()) {
      onShowToast('Wajib Login', 'Login sebagai panitia untuk menguji gateway WhatsApp.', 'error');
      return;
    }
    setIsTesting(true);
    try {
      const result = await BroadcastApiService.testMessage(phone);
      const ok = result?.ok ?? result?.status === 'sent';
      onShowToast(
        ok ? 'Koneksi Gateway Berhasil' : 'Koneksi Gateway Gagal',
        `Provider: ${result?.provider ?? '-'}${result?.error ? ` — ${result.error}` : ''}`,
        ok ? 'success' : 'error'
      );
    } catch {
      onShowToast('Uji Koneksi Gagal', 'Server tidak merespons permintaan uji gateway.', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    // Secret hanya diteruskan bila diisi; kosong = tidak diubah (server masked).
    onUpdateConfig({
      ...schoolConfig,
      waGatewayProvider: provider,
      ...(apiKey.trim() !== '' ? { waApiKey: apiKey } : {}),
      waSenderNumber: senderNumber,
      waActive: isGatewayActive,
    });
    addAuditLog('WA_GATEWAY_CONFIG', `Konfigurasi WA Gateway diubah: Provider ${provider}, Status: ${isGatewayActive ? 'Aktif' : 'Nonaktif'}`, 'Admin', 'admin_tu');
    onShowToast('Pengaturan Disimpan', 'Konfigurasi WhatsApp Gateway berhasil diperbarui.', 'success');
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTemplate.trim()) {
      onShowToast('Pesan Kosong', 'Tulis pesan yang akan disiarkan terlebih dahulu.', 'error');
      return;
    }

    // Server-first: kirim via API bila login panitia (log per-penerima di server).
    if (TokenStorage.hasSession()) {
      setIsSending(true);
      try {
        const report = await BroadcastApiService.send(
          `Siaran ${broadcastTarget}`,
          broadcastTemplate,
          TARGET_TO_AUDIENCE[broadcastTarget]
        );
        const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
        setBroadcastLogs((prev) => [
          {
            id: `SRV-${Date.now()}`,
            recipientGroup: `${broadcastTarget} (server)`,
            totalRecipients: report.total,
            deliveredCount: report.sent,
            messagePreview: `${broadcastTemplate.slice(0, 60)}...`,
            sentAt: now,
            status: report.failed === 0 ? 'Terkirim' : 'Sebagian Terkirim',
          },
          ...prev,
        ]);
        addAuditLog('WA_BROADCAST_SENT', `Siaran server ke ${broadcastTarget}: ${report.sent}/${report.total} terkirim`, 'Admin Humas', 'admin_tu');
        onShowToast('Siaran Terkirim', `${report.sent}/${report.total} pesan tercatat di server.`, 'success');
        return;
      } catch {
        onShowToast('Siaran Server Gagal', 'Server tidak merespons — siaran DIBATALKAN, tidak ada simulasi sukses.', 'error');
        return;
      } finally {
        setIsSending(false);
      }
    }
    // Tanpa sesi: tolak tegas (tidak ada simulasi sukses palsu).
    onShowToast('Wajib Login', 'Login sebagai panitia untuk mengirim siaran resmi.', 'error');
    return;
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
          <Radio className="w-4 h-4 text-emerald-700 animate-pulse" />
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
              className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Simpan Konfigurasi Gateway
            </button>
          </form>

          {/* Uji Koneksi Gateway */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-teal-600" />
              <span>Uji Koneksi Gateway</span>
            </span>
            <p className="text-xs text-slate-500">
              Kirim pesan uji ke satu nomor untuk memastikan provider aktif dan kredensial benar.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="62812xxxxxxx"
                data-testid="input-wa-test-phone"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={handleTestMessage}
                disabled={isTesting}
                data-testid="btn-wa-test"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Uji Koneksi</span>
              </button>
            </div>
          </div>
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
              <span className="text-[11px] text-slate-500 font-medium">Log Tersimpan</span>
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
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
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

            <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Ringkasan Pesan</th>
                    <th className="p-3 text-right">Terkirim</th>
                    <th className="p-3 text-right">Status</th>
                    <th className="p-3 text-right">Aksi</th>
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
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenLogs(log)}
                          data-testid={`btn-broadcast-logs-${log.id.slice(0, 8)}`}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          Lihat Log
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Dead-letter view: log notifikasi server + kirim ulang baris gagal. */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4" data-testid="notifications-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Log Notifikasi Terkirim</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Jejak pengiriman WhatsApp (presensi &amp; siaran). Baris gagal bisa dikirim ulang manual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={notificationFilter}
              onChange={(e) => {
                const next = e.target.value as '' | ServerNotificationLog['status'];
                setNotificationFilter(next);
                void loadNotifications(next);
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700"
              data-testid="input-notification-status"
            >
              <option value="">Semua status</option>
              <option value="sent">Terkirim</option>
              <option value="failed">Gagal</option>
              <option value="processing">Diproses</option>
              <option value="pending">Menunggu</option>
            </select>
            <button
              type="button"
              onClick={() => void loadNotifications(notificationFilter)}
              data-testid="btn-refresh-notifications"
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
              <span>Muat ulang</span>
            </button>
          </div>
        </div>

        {notificationLogs.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500" data-testid="notifications-empty">
            Belum ada log notifikasi (atau Anda belum login sebagai panitia).
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Penerima</th>
                  <th className="p-3">Template</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Percobaan</th>
                  <th className="p-3">Error</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notificationLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 align-top">
                    <td className="p-3 font-mono text-slate-700">{log.recipient}</td>
                    <td className="p-3 text-slate-600">{log.template.split(':')[0]}</td>
                    <td className="p-3">
                      <Badge
                        variant={log.status === 'sent' ? 'success' : log.status === 'failed' ? 'danger' : 'neutral'}
                        size="sm"
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600">{log.attempts}</td>
                    <td className="p-3 text-slate-500 max-w-xs break-words">{log.last_error ?? '—'}</td>
                    <td className="p-3 text-right">
                      {log.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => void handleRetryNotification(log.id)}
                          data-testid={`btn-notification-retry-${log.id.slice(0, 8)}`}
                          className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap"
                        >
                          Kirim Ulang
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={logModalBroadcast !== null}
        onClose={() => setLogModalBroadcast(null)}
        title="Log Pengiriman Siaran"
        subtitle={logModalBroadcast ? `${logModalBroadcast.recipientGroup} • ${logModalBroadcast.sentAt}` : undefined}
        maxWidth="3xl"
        dataTestId="modal-broadcast-logs"
      >
        {isLoadingLogs ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Memuat log penerima...</span>
          </div>
        ) : logRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            Belum ada log penerima untuk siaran ini.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Penerima</th>
                  <th className="p-3">Nomor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Respons Provider</th>
                  <th className="p-3">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 align-top">
                    <td className="p-3 font-bold text-slate-800">{row.recipient_name}</td>
                    <td className="p-3 font-mono text-slate-600 text-[11px]">
                      {row.recipient_phone ?? '•••'}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          row.status === 'sent'
                            ? 'success'
                            : row.status === 'failed'
                              ? 'danger'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs break-words">
                      {row.provider_response ?? '—'}
                    </td>
                    <td className="p-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {String(row.created_at).slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};
