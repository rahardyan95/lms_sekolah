import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, ShieldAlert, KeyRound, Lock, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { getAuditLogs, addAuditLog } from '../../utils/helpers';
import { AuditLog } from '../../types';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRole: string;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  activeRole,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>(getAuditLogs());
  const [csrfToken] = useState('csrf_sim_token_88a91c7f902b4d5e');

  const refreshLogs = () => {
    addAuditLog('SECURITY_AUDIT_VIEW', 'Auditor membuka log jejak audit keamanan sistem', 'Security Officer', activeRole);
    setLogs(getAuditLogs());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Security & RBAC Audit Inspector"
      subtitle="Analisis keamanan sistem, isolasi sesi pengguna, dan pencatatan jejak audit"
      maxWidth="3xl"
      dataTestId="security-audit-modal"
    >
      <div className="space-y-6">
        {/* Security Health Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-emerald-900">RBAC Guard Active</p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Akses terbatas sesuai 8 peran izin terisolasi.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 flex items-start gap-3">
            <Lock className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-teal-900">Data Masking</p>
              <p className="text-[11px] text-teal-700 mt-1">
                NIK, Nomor HP & Password dienkripsi pada UI.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 flex items-start gap-3">
            <KeyRound className="w-6 h-6 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-sky-900">CSRF Header Verified</p>
              <p className="text-[11px] font-mono text-sky-800 mt-1 truncate max-w-[170px]">
                {csrfToken}
              </p>
            </div>
          </div>
        </div>

        {/* Security Policies Overview */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Kebijakan Keamanan Sistem Aktif:</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pl-6 list-disc">
            <li>Proteksi Injeksi SQL via PostgreSQL Prepared Statements</li>
            <li>Sanitasi Input XSS pada seluruh form dan view</li>
            <li>Enkripsi Password dengan standar Argon2id</li>
            <li>Sesi Login terisolasi (Multi-guard per portal)</li>
            <li>Validasi OTP 6-Digit WhatsApp berlaku 5 menit</li>
            <li>Pemeriksaan Hak Akses CBT Room saat ujian berlangsung</li>
          </ul>
        </div>

        {/* Audit Trail Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Log Jejak Aktivitas Terakhir (Audit Trail)
              </h4>
            </div>
            <button
              onClick={refreshLogs}
              className="inline-flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-medium px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Segarkan Log
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Pengguna & Role</th>
                  <th className="p-3">Aksi</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3 font-sans">
                      <span className="font-semibold text-slate-800">{log.user}</span>
                      <span className="block text-[10px] text-teal-600 uppercase font-mono mt-0.5">
                        {log.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-600 max-w-xs">{log.details}</td>
                    <td className="p-3 text-right text-slate-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Tutup Panel Audit
          </button>
        </div>
      </div>
    </Modal>
  );
};
