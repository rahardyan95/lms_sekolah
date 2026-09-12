import React, { useState, useEffect } from 'react';
import {
  StudentSppProfile,
  CashTransaction,
  Student,
  SchoolConfig,
  SppMonthStatus,
} from '../../../types';
import {
  CreditCard,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Filter,
  Search,
  FileText,
  Calendar,
  DollarSign,
  Building,
  CheckCircle2,
  AlertCircle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { EmptyState } from '../../common/EmptyState';
import { formatRupiah, formatDate, terbilang, addAuditLog } from '../../../utils/helpers';
import {
  FinanceApiService,
  type ServerPaymentItem,
  type ServerSummary,
  type ServerPayment,
  type ServerBankAccount,
  type ServerCashTransaction,
  type ServerCashReport,
} from '../../../services/FinanceApiService';
import { AcademicApiService } from '../../../services/AcademicApiService';
import { StudentService } from '../../../services/DomainService';
import { TokenStorage } from '../../../services/TokenStorage';

interface FinanceModuleProps {
  sppProfile?: StudentSppProfile;
  students: Student[];
  cashTransactions: CashTransaction[];
  schoolConfig: SchoolConfig;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  sppProfile: initialSpp,
  students,
  cashTransactions: initialTransactions,
  schoolConfig,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'spp_matrix' | 'buku_kas' | 'pos_biaya' | 'kas_bank' | 'reports'
  >('spp_matrix');
  const [sppProfile, setSppProfile] = useState<StudentSppProfile | null>(initialSpp ?? null);
  const [transactions, setTransactions] = useState<CashTransaction[]>(initialTransactions);

  // Kwitansi Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<{
    receiptNumber: string;
    studentName: string;
    nisn: string;
    kelas: string;
    month: string;
    nominal: number;
    paidDate: string;
  } | null>(null);

  // New Transaction Form Modal
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'Pemasukan' | 'Pengeluaran'>('Pemasukan');
  const [txCategory, setTxCategory] = useState('SPP Siswa');
  const [txAmount, setTxAmount] = useState('500000');
  const [txDesc, setTxDesc] = useState('');
  const [txPic, setTxPic] = useState('Ibu Endang Sulistyo (Bendahara)');

  // Server-first: ringkasan tagihan siswa demo dari API bila login bendahara.
  const [serverSummary, setServerSummary] = useState<ServerSummary | null>(null);
  // Identitas siswa pemilik ringkasan LIVE (dari server) — dipakai kwitansi
  // dan refresh pasca-bayar. Tanpa ini (bundle produksi tanpa mock) panel
  // LIVE tidak pernah tampil dan kwitansi kehilangan nama siswa.
  const [summaryStudent, setSummaryStudent] = useState<{ id: string; name: string; nisn: string; kelas: string } | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [serverItems, setServerItems] = useState<ServerPaymentItem[] | null>(null);
  const [itemsStale, setItemsStale] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('500000');

  // Pembayaran server yang berhasil diproses pada sesi ini (kwitansi PDF per baris).
  const [serverPayments, setServerPayments] = useState<ServerPayment[]>([]);

  // Distribusi tagihan (POST /finance/items/{item}/distribute)
  const [distributeItem, setDistributeItem] = useState<ServerPaymentItem | null>(null);
  const [classRooms, setClassRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [distributeClassId, setDistributeClassId] = useState('');
  const [distributePeriod, setDistributePeriod] = useState('');
  const [distributing, setDistributing] = useState(false);

  // Tab Kas & Bank
  const [serverCash, setServerCash] = useState<ServerCashTransaction[] | null>(null);
  const [cashStale, setCashStale] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<ServerBankAccount[] | null>(null);
  const [cashType, setCashType] = useState<'income' | 'expense'>('income');
  // Kanal dana transaksi kas: '' = kas tunai, selain itu id rekening bank.
  const [cashBankAccountId, setCashBankAccountId] = useState('');
  const [cashCategory, setCashCategory] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashDate, setCashDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingCash, setSavingCash] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Tab Laporan
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10));
  const [cashReport, setCashReport] = useState<ServerCashReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Penyesuaian tagihan (baris baru bertanda; pembayaran asli tidak diubah).
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; title: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('-10000');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const refreshServerSummary = async (studentId: string) => {
    const summary = await FinanceApiService.summary(studentId);
    setServerSummary(summary);
  };

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void (async () => {
      // Tanpa mock (produksi), "siswa demo" = siswa pertama katalog server;
      // dengan mock DEV, siswa demo tetap dicari berdasar NISN-nya.
      try {
        const rows = await StudentService.list(sppProfile?.nisn ?? '');
        const target = rows[0];
        if (!target || cancelled) return;
        const summary = await FinanceApiService.summary(target.id);
        if (cancelled) return;
        setSummaryStudent({ id: target.id, name: target.name, nisn: target.nisn, kelas: target.kelas });
        setServerSummary(summary);
      } catch {
        /* fallback mock */
      }
      try {
        const items = await FinanceApiService.items();
        if (!cancelled) {
          setServerItems(items);
          setItemsStale(false);
        }
      } catch {
        if (!cancelled) setItemsStale(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Muat data kas & rekening bank saat tab Kas & Bank aktif.
  useEffect(() => {
    if (activeTab !== 'kas_bank' || !TokenStorage.hasSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await FinanceApiService.cash();
        if (!cancelled) {
          setServerCash(rows);
          setCashStale(false);
        }
      } catch {
        if (!cancelled) setCashStale(true);
      }
      try {
        const accounts = await FinanceApiService.bankAccounts();
        if (!cancelled) setBankAccounts(accounts);
      } catch {
        /* biarkan daftar rekening kosong */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openDistribute = (item: ServerPaymentItem) => {
    setDistributeItem(item);
    setDistributeClassId('');
    setDistributePeriod('');
    void AcademicApiService.classes()
      .then((rows) => setClassRooms(rows.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setClassRooms([]));
  };

  const handleDistributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributeItem) return;
    setDistributing(true);
    try {
      const result = await FinanceApiService.distribute(distributeItem.id, {
        class_room_id: distributeClassId || undefined,
        period: distributePeriod || undefined,
      });
      onShowToast(
        'Distribusi Tagihan',
        `${result.created} tagihan dibuat, ${result.skipped} dilewati.`,
        'success',
      );
      setDistributeItem(null);
    } catch {
      onShowToast('Distribusi Gagal', 'Server menolak permintaan distribusi.', 'error');
    } finally {
      setDistributing(false);
    }
  };

  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(cashAmount, 10);
    if (!cashCategory.trim() || isNaN(amount) || amount <= 0) {
      onShowToast('Input Salah', 'Kategori dan nominal kas yang valid wajib diisi.', 'error');
      return;
    }
    setSavingCash(true);
    try {
      await FinanceApiService.createCash({
        type: cashType,
        category: cashCategory.trim(),
        amount,
        transaction_at: cashDate,
        bank_account_id: cashBankAccountId === '' ? null : cashBankAccountId,
      });
      const rows = await FinanceApiService.cash();
      setServerCash(rows);
      setCashCategory('');
      setCashAmount('');
      setCashBankAccountId('');
      onShowToast('Transaksi Kas Disimpan', 'Mutasi kas tersimpan di server.', 'success');
    } catch {
      onShowToast('Gagal Menyimpan', 'Server menolak transaksi kas. Coba lagi.', 'error');
    } finally {
      setSavingCash(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !bankAccountNo.trim() || !bankHolder.trim()) {
      onShowToast('Input Salah', 'Bank, nomor rekening, dan pemilik wajib diisi.', 'error');
      return;
    }
    setSavingBank(true);
    try {
      await FinanceApiService.createBankAccount({
        bank: bankName.trim(),
        account_number: bankAccountNo.trim(),
        holder: bankHolder.trim(),
      });
      const accounts = await FinanceApiService.bankAccounts();
      setBankAccounts(accounts);
      setBankName('');
      setBankAccountNo('');
      setBankHolder('');
      onShowToast('Rekening Disimpan', 'Rekening bank tersimpan di server.', 'success');
    } catch {
      onShowToast('Gagal Menyimpan', 'Server menolak data rekening. Coba lagi.', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleLoadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingReport(true);
    try {
      setCashReport(await FinanceApiService.cashReport(reportFrom, reportTo));
    } catch {
      onShowToast('Gagal Memuat', 'Laporan kas tidak dapat dimuat dari server.', 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleAdjustSubmit = async () => {
    if (!adjustTarget) return;

    const amount = Number(adjustAmount);
    if (!Number.isInteger(amount) || amount === 0 || adjustReason.trim() === '') {
      onShowToast('Data Penyesuaian Tidak Valid', 'Nominal (≠0, boleh negatif) dan alasan wajib diisi.', 'warning');
      return;
    }

    setAdjusting(true);

    try {
      await FinanceApiService.adjustInvoice(adjustTarget.id, amount, adjustReason.trim());
      onShowToast('Penyesuaian Tersimpan', 'Baris penyesuaian dibuat tanpa mengubah pembayaran asli.', 'success');
      setAdjustTarget(null);
      setAdjustAmount('-10000');
      setAdjustReason('');
      if (summaryStudent) await refreshServerSummary(summaryStudent.id);
    } catch {
      onShowToast('Penyesuaian Gagal', 'Server menolak permintaan penyesuaian.', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string, remaining: number, title: string, studentId?: string) => {
    if (remaining <= 0) return;
    setPayingId(invoiceId);
    try {
      const payment = await FinanceApiService.pay(invoiceId, {
        amount: remaining,
        method: 'tunai',
        reference: `WEB-${invoiceId.slice(0, 8)}-${Date.now().toString().slice(-6)}`,
      });
      // Kwitansi resmi ada di server (PDF); pemanggilan invoices() dengan
      // invoice_id sebagai student_id salah semantic dan hasilnya dibuang.
      addAuditLog('SPP_PAYMENT_PROCESSED', `Pembayaran ${title} lunas via server. Kwitansi ${payment.receipt_number}`, 'Bendahara', 'bendahara');
      onShowToast('Pembayaran Berhasil', `Kwitansi ${payment.receipt_number} diterbitkan server.`, 'success');
      setSelectedReceipt({
        receiptNumber: payment.receipt_number,
        studentName: summaryStudent?.name ?? sppProfile?.studentName ?? '',
        nisn: summaryStudent?.nisn ?? sppProfile?.nisn ?? '',
        kelas: summaryStudent?.kelas ?? sppProfile?.kelas ?? '',
        month: title,
        nominal: payment.amount,
        paidDate: new Date().toISOString().slice(0, 10),
      });
      setServerPayments((prev) => [payment, ...prev]);
      // Refresh ringkasan siswa yang tagihannya baru dibayar — id diambil dari
      // invoice (student_id), bukan pencarian NISN mock yang bisa salah siswa.
      const targetId = studentId ?? summaryStudent?.id;
      if (targetId) {
        try {
          await refreshServerSummary(String(targetId));
        } catch {
          /* abaikan */
        }
      }
    } catch {
      onShowToast('Pembayaran Gagal', 'Server menolak (duplikat/lewat batas). Coba lagi.', 'error');
    } finally {
      setPayingId(null);
    }
  };

  // Quick SPP Pay simulation for a specific month
  // DITANDAI: hanya simulasi lokal DEV (matriks mock). Pembayaran resmi wajib
  // lewat panel LIVE API (handlePayInvoice → server + kwitansi unik).
  const handlePayMonth = (monthName: string) => {
    if (!sppProfile) return;

    const updatedMonths = sppProfile.months.map((m) => {
      if (m.month === monthName && m.status !== 'Lunas') {
        const receiptNo = `KW-2026-${Date.now().toString().slice(-4)}`;
        return {
          ...m,
          status: 'Lunas' as SppMonthStatus,
          paidAmount: m.fee,
          paidDate: '2026-09-08',
          receiptNumber: receiptNo,
        };
      }
      return m;
    });

    const totalPaid = updatedMonths.reduce((acc, m) => acc + m.paidAmount, 0);
    const sisa = sppProfile.totalTagihan - totalPaid;

    const updatedProfile: StudentSppProfile = {
      ...sppProfile,
      months: updatedMonths,
      totalDibayar: totalPaid,
      sisaTagihan: sisa,
    };

    setSppProfile(updatedProfile);

    // Auto-record to Cash Book
    const newTx: CashTransaction = {
      id: `TRX-${Date.now()}`,
      date: '2026-09-08',
      type: 'Pemasukan',
      category: 'SPP Siswa Bulanan',
      description: `Pembayaran SPP ${monthName} (${sppProfile.studentName} - ${sppProfile.kelas})`,
      amount: 500000,
      proofNumber: `BKM-09-${Date.now().toString().slice(-3)}`,
      pic: 'Ibu Endang Sulistyo',
    };
    setTransactions([newTx, ...transactions]);

    addAuditLog('SPP_PAYMENT_PROCESSED', `Pembayaran SPP ${monthName} lunas untuk ${sppProfile.studentName} Rp 500.000`, 'Bendahara', 'bendahara');
    onShowToast('Pembayaran SPP Berhasil', `SPP ${monthName} berhasil dicatat lunas. Kwitansi otomatis diterbitkan.`, 'success');
  };

  // Open Receipt
  const handleOpenReceipt = (month: string, nominal: number, receiptNo: string) => {
    if (!sppProfile) return;

    setSelectedReceipt({
      receiptNumber: receiptNo,
      studentName: sppProfile.studentName,
      nisn: sppProfile.nisn,
      kelas: sppProfile.kelas,
      month,
      nominal,
      paidDate: '2026-09-08',
    });
  };

  // Handle New Transaction Submit
  const handleNewTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(txAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      onShowToast('Nominal Salah', 'Masukkan nominal transaksi yang valid.', 'error');
      return;
    }

    const newTx: CashTransaction = {
      id: `TRX-${Date.now()}`,
      date: '2026-09-08',
      type: txType,
      category: txCategory,
      description: txDesc || `${txType} ${txCategory}`,
      amount: amountNum,
      proofNumber: `${txType === 'Pemasukan' ? 'BKM' : 'BKK'}-09-${Date.now().toString().slice(-3)}`,
      pic: txPic,
    };

    setTransactions([newTx, ...transactions]);
    addAuditLog('CASH_TX_CREATE', `${txType} kas Rp ${formatRupiah(amountNum)}: ${txDesc}`, txPic, 'bendahara');
    onShowToast('Transaksi Disimpan', `Transaksi kas operasional ${txType} berhasil dicatat ke buku besar.`, 'success');
    setIsNewTxModalOpen(false);
    setTxDesc('');
  };

  // Calculate Cash Book summary
  const totalPemasukan = transactions
    .filter((t) => t.type === 'Pemasukan')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalPengeluaran = transactions
    .filter((t) => t.type === 'Pengeluaran')
    .reduce((acc, t) => acc + t.amount, 0);

  const saldoKas = totalPemasukan - totalPengeluaran;

  return (
    <div className="space-y-6" data-testid="finance-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-600" />
            <span>Manajemen Keuangan Sekolah & SPP Bulanan</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan matriks SPP 12 bulan, buku kas arus kas (income/expense), serta pencetakan kwitansi resmi
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('spp_matrix')}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'spp_matrix'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-spp"
          >
            Matriks SPP 12 Bulan
          </button>
          <button
            onClick={() => setActiveTab('buku_kas')}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'buku_kas'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-kas"
          >
            Buku Kas Operasional
          </button>
          <button
            onClick={() => setActiveTab('pos_biaya')}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'pos_biaya'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-pos"
          >
            Master Pos Biaya
          </button>
          <button
            onClick={() => setActiveTab('kas_bank')}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'kas_bank'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-cash"
          >
            Kas & Bank
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`shrink-0 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'reports'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-reports"
          >
            Laporan
          </button>
        </div>
      </div>

      {/* VIEW 1: 12-MONTH SPP MATRIX */}
      {activeTab === 'spp_matrix' && (
        <div className="space-y-6">
          {serverSummary !== null && (
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-3" data-testid="finance-server-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Tagihan Server (Live API)
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                  LIVE API
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-semibold">Total Tagihan</span>
                  <p className="text-base font-black text-slate-900">{formatRupiah(serverSummary.total_tagihan)}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 font-semibold">Terbayar</span>
                  <p className="text-base font-black text-emerald-800">{formatRupiah(serverSummary.total_dibayar)}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-rose-700 font-semibold">Sisa</span>
                  <p className="text-base font-black text-rose-800">{formatRupiah(serverSummary.sisa)}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {serverSummary.invoices.map((inv) => {
                  const remaining = inv.amount - inv.paid_amount;
                  return (
                    <div key={inv.id} className="p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800">{inv.title}</p>
                          <p className="text-slate-500 font-mono text-[11px]">
                            {inv.status.toUpperCase()} · {formatRupiah(inv.paid_amount)}/{formatRupiah(inv.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {remaining > 0 ? (
                            <button
                              type="button"
                              disabled={payingId === inv.id}
                              onClick={() => void handlePayInvoice(inv.id, remaining, inv.title, inv.student_id)}
                              className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold"
                              data-testid={`btn-pay-${inv.id.slice(0, 8)}`}
                            >
                              {payingId === inv.id ? 'Memproses…' : `Bayar ${formatRupiah(remaining)}`}
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">LUNAS</span>
                          )}
                          {/* Penyesuaian: denda/diskon/koreksi — baris baru, bukan edit baris lama */}
                          <button
                            type="button"
                            onClick={() => setAdjustTarget(adjustTarget?.id === inv.id ? null : { id: inv.id, title: inv.title })}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            data-testid={`btn-adjust-${inv.id.slice(0, 8)}`}
                          >
                            Sesuaikan
                          </button>
                        </div>
                      </div>

                      {adjustTarget?.id === inv.id && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2" data-testid={`adjust-form-${inv.id.slice(0, 8)}`}>
                          <p className="text-[11px] text-slate-500">
                            Nominal boleh negatif (pengurangan) atau positif (denda). Pembayaran asli tidak diubah.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              aria-label="Nominal penyesuaian"
                              className="w-32 px-3 py-2 rounded-lg border border-slate-200"
                              data-testid="input-adjust-amount"
                            />
                            <input
                              type="text"
                              value={adjustReason}
                              onChange={(e) => setAdjustReason(e.target.value)}
                              placeholder="Alasan penyesuaian (mis. diskon yatim)"
                              aria-label="Alasan penyesuaian"
                              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-200"
                              data-testid="input-adjust-reason"
                            />
                            <button
                              type="button"
                              disabled={adjusting}
                              onClick={() => void handleAdjustSubmit()}
                              className="min-h-11 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold disabled:opacity-60"
                              data-testid="btn-adjust-submit"
                            >
                              {adjusting ? 'Menyimpan…' : 'Simpan Penyesuaian'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {serverSummary.invoices.length === 0 && (
                  <p className="p-3 text-xs text-slate-500">Belum ada tagihan untuk siswa demo.</p>
                )}
              </div>
              {serverPayments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Kwitansi Pembayaran Server
                  </h5>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {serverPayments.map((payment) => (
                      <div key={payment.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <p className="font-mono font-bold text-slate-800">{payment.receipt_number}</p>
                          <p className="text-slate-500 font-mono text-[11px]">
                            {payment.paid_at} · {formatRupiah(payment.amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => window.open(FinanceApiService.receiptPdfUrl(payment.id), '_blank', 'noopener')}
                          className="px-3 py-1.5 rounded-lg bg-white border border-teal-200 hover:bg-teal-50 text-teal-700 font-bold flex items-center gap-1"
                          data-testid={`btn-receipt-pdf-${payment.id.slice(0, 8)}`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Kwitansi PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Matriks SPP lokal: hanya bila profil siswa tersedia (DEV/mock). */}
          {sppProfile && (
          <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold">Total Tagihan Siswa</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{formatRupiah(sppProfile.totalTagihan)}</p>
              <p className="text-[11px] text-slate-500 mt-1">12 Bulan Tahun Pelajaran {schoolConfig.academicYear}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-xs text-emerald-700 font-semibold">Total Terbayar</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{formatRupiah(sppProfile.totalDibayar)}</p>
              <p className="text-[11px] text-emerald-700 mt-1">Telah diverifikasi oleh Bendahara</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <span className="text-xs text-rose-700 font-semibold">Sisa Tunggakan Berjalan</span>
              <p className="text-2xl font-black text-rose-800 mt-1">{formatRupiah(sppProfile.sisaTagihan)}</p>
              <p className="text-[11px] text-rose-600 mt-1">Sisa 4 bulan belum lunas</p>
            </div>
          </div>

          {/* Student Info Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Siswa Terpilih: </span>
              <strong className="text-slate-900">{sppProfile.studentName}</strong>
              <span className="text-slate-500 font-mono ml-2">({sppProfile.nisn} — {sppProfile.kelas})</span>
            </div>
            <span className="text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              Tarif SPP: Rp 500.000 / Bulan
            </span>
          </div>

          {/* 12-Month Matrix Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Tabel Matriks Pembayaran SPP (Juli s.d. Juni)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sppProfile.months.map((m) => (
                <div
                  key={m.month}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                    m.status === 'Lunas'
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{m.month}</h4>
                      <p className="text-xs font-mono font-semibold text-slate-600 mt-0.5">
                        {formatRupiah(m.fee)}
                      </p>
                    </div>
                    <Badge variant={m.status === 'Lunas' ? 'success' : 'neutral'}>
                      {m.status}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    {m.status === 'Lunas' ? (
                      <>
                        <div className="text-[10px] text-slate-500 font-mono leading-tight">
                          <p>Tgl: {m.paidDate}</p>
                          <p>{m.receiptNumber}</p>
                        </div>
                        <button
                          onClick={() => handleOpenReceipt(m.month, m.fee, m.receiptNumber || 'KW-001')}
                          className="px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-white border border-teal-200 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                          title="Cetak Kwitansi Pembayaran"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Kwitansi</span>
                        </button>
                      </>
                      ) : (
                      <button
                        onClick={() => handlePayMonth(m.month)}
                        className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-xs font-bold transition-colors shadow-xs"
                        data-testid={`btn-pay-spp-${m.month}`}
                        title="Simulasi lokal DEV — pembayaran resmi lewat panel LIVE API"
                      >
                        Bayar (Simulasi Lokal)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
          )}
          {!sppProfile && serverSummary === null && (
            <EmptyState
              title="Data tagihan belum tersedia"
              message="Belum ada tagihan pada server untuk siswa ini dan matriks SPP lokal tidak dimuat."
              testId="finance-empty-state"
            />
          )}
        </div>
      )}

      {/* VIEW 2: BUKU KAS OPERASIONAL */}
      {activeTab === 'buku_kas' && (
        <div className="space-y-6">
          {/* Cash Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-700 font-semibold">Total Pemasukan</span>
                <p className="text-2xl font-black text-emerald-900 mt-1">{formatRupiah(totalPemasukan)}</p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-emerald-700 bg-emerald-100 p-1.5 rounded-xl shrink-0" />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-rose-700 font-semibold">Total Pengeluaran</span>
                <p className="text-2xl font-black text-rose-900 mt-1">{formatRupiah(totalPengeluaran)}</p>
              </div>
              <ArrowDownRight className="w-8 h-8 text-rose-600 bg-rose-100 p-1.5 rounded-xl shrink-0" />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-teal-200 bg-teal-50/20 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-teal-700 font-semibold">Saldo Kas Berjalan</span>
                <p className="text-2xl font-black text-teal-900 mt-1">{formatRupiah(saldoKas)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-teal-600 bg-teal-100 p-1.5 rounded-xl shrink-0" />
            </div>
          </div>

          {/* Table of Cash Transactions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Buku Besar Arus Kas Masuk & Keluar (Ledger)
              </h3>
              <button
                onClick={() => setIsNewTxModalOpen(true)}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                data-testid="btn-add-transaction"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Transaksi Baru</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl" tabIndex={0} role="region" aria-label="Tabel data (geser horizontal bila perlu)">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">No. Bukti</th>
                    <th className="p-3.5">Jenis</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5">Deskripsi Transaksi</th>
                    <th className="p-3.5 text-right">Nominal</th>
                    <th className="p-3.5">Penanggung Jawab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80">
                      <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{tx.proofNumber}</td>
                      <td className="p-3.5">
                        <Badge variant={tx.type === 'Pemasukan' ? 'success' : 'danger'}>
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">{tx.category}</td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate">{tx.description}</td>
                      <td
                        className={`p-3.5 text-right font-mono font-bold ${
                          tx.type === 'Pemasukan' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.type === 'Pemasukan' ? '+' : '-'} {formatRupiah(tx.amount)}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">{tx.pic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MASTER POS BIAYA */}
      {activeTab === 'pos_biaya' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Daftar Komponen & Pos Pembayaran Sekolah
            </h3>
            <span className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Tahun Ajaran {schoolConfig.academicYear}</span>
              {serverItems !== null && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono" data-testid="finance-items-live">
                  LIVE API
                </span>
              )}
            </span>
          </div>

          {serverItems !== null ? (
            <div className="space-y-3" data-testid="finance-items-server">
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = parseInt(newItemAmount, 10);
                  if (!newItemName.trim() || isNaN(amount) || amount < 0) {
                    onShowToast('Input Salah', 'Nama pos dan nominal valid wajib diisi.', 'error');
                    return;
                  }
                  void FinanceApiService.createItem({ name: newItemName.trim(), category: 'SPP', amount })
                    .then(async () => {
                      const items = await FinanceApiService.items();
                      setServerItems(items);
                      setNewItemName('');
                      onShowToast('Pos Biaya Dibuat', 'Pos pembayaran tersimpan di server.', 'success');
                    })
                    .catch(() => onShowToast('Gagal Menyimpan', 'Server menolak. Coba lagi.', 'error'));
                }}
              >
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nama pos baru (mis. SPP Agustus)"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  aria-label="Nama pos biaya baru"
                />
                <input
                  type="number"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  min={0}
                  className="w-40 px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  aria-label="Nominal pos biaya baru"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl"
                  data-testid="btn-create-item"
                >
                  Tambah Pos
                </button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serverItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <span className="font-mono font-bold text-teal-700 text-xs">{formatRupiah(item.amount)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {item.category}{item.academic_year ? ` · ${item.academic_year}` : ''} · {item.active ? 'Aktif' : 'Nonaktif'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openDistribute(item)}
                      className="w-full py-1.5 text-[11px] font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                      data-testid={`btn-distribute-${item.id.slice(0, 8)}`}
                    >
                      Distribusikan ke Kelas
                    </button>
                  </div>
                ))}
                {serverItems.length === 0 && (
                  <p className="text-xs text-slate-500">Belum ada pos biaya di server.</p>
                )}
              </div>
            </div>
          ) : (
          <>
          {itemsStale && TokenStorage.hasSession() && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2" role="status">
              Pos biaya server tidak dapat dimuat — menampilkan daftar lokal.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">SPP Bulanan Rutin</span>
                <span className="font-mono font-bold text-teal-700 text-xs">Rp 500.000 / Bulan</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Biaya operasional pendidikan mencakup pembelajaran praktik, internet fiber optic, dan akses penuh perpustakaan digital.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">Uang Pengembangan Sarana (Gedung)</span>
                <span className="font-mono font-bold text-teal-700 text-xs">Rp 3.500.000 (Sekali)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Peningkatan mutu fasilitas workstation laboratorium komputer, server rack, dan studio multimedia.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">Paket Seragam & Atribut KTS</span>
                <span className="font-mono font-bold text-teal-700 text-xs">Rp 1.200.000 (Sekali)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                3 pasang seragam resmi, seragam praktik bengkel/lab, topi, dasi, dan kartu tanda pelajar digital ISO CR-80.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-900">Biaya Pendaftaran SPMB / PPDB</span>
                <span className="font-mono font-bold text-teal-700 text-xs">Rp 200.000 (Pendaftaran)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Biaya administrasi seleksi berkas, tes potensi akademik online CBT, dan tes wawancara peminatan jurusan.
              </p>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* VIEW 4: KAS & BANK */}
      {activeTab === 'kas_bank' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Entri Transaksi Kas
            </h3>
            <form onSubmit={handleSaveCash} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jenis</label>
                <select
                  value={cashType}
                  onChange={(e) => setCashType(e.target.value as 'income' | 'expense')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-cash-type"
                >
                  <option value="income">Pemasukan (Income)</option>
                  <option value="expense">Pengeluaran (Expense)</option>
                </select>
              </div>
              <div>
                <label htmlFor="cash-channel-select" className="block text-[11px] font-semibold text-slate-600 mb-1">Kanal Dana</label>
                <select
                  id="cash-channel-select"
                  value={cashBankAccountId}
                  onChange={(e) => setCashBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-cash-channel"
                >
                  <option value="">Kas Tunai</option>
                  {(bankAccounts ?? []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank} {acc.account_masked}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kategori</label>
                <input
                  type="text"
                  value={cashCategory}
                  onChange={(e) => setCashCategory(e.target.value)}
                  required
                  placeholder="mis. Operasional"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-cash-category"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nominal</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  required
                  min={1}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  data-testid="input-cash-amount"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={cashDate}
                  onChange={(e) => setCashDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  data-testid="input-cash-date"
                />
              </div>
              <button
                type="submit"
                disabled={savingCash}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-xs"
                data-testid="btn-save-cash"
              >
                {savingCash ? 'Menyimpan…' : 'Simpan Kas'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Mutasi Kas Server
            </h3>
            {cashStale && TokenStorage.hasSession() && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2" role="status">
                Data kas server tidak dapat dimuat.
              </p>
            )}
            {serverCash === null ? (
              <p className="text-xs text-slate-500">
                {TokenStorage.hasSession() ? 'Memuat data kas…' : 'Masuk sebagai bendahara untuk memuat data kas.'}
              </p>
            ) : serverCash.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada transaksi kas di server.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">Jenis</th>
                      <th className="p-3.5">Kategori</th>
                      <th className="p-3.5">PIC</th>
                      <th className="p-3.5 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serverCash.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">{tx.transaction_at}</td>
                        <td className="p-3.5">
                          <Badge variant={tx.type === 'income' ? 'success' : 'danger'}>
                            {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                          </Badge>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-800">{tx.category}</td>
                        <td className="p-3.5 text-slate-500 text-[11px]">{tx.pic ?? '-'}</td>
                        <td className={`p-3.5 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {tx.type === 'income' ? '+' : '-'} {formatRupiah(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Building className="w-4 h-4 text-teal-600" />
              <span>Rekening Bank Sekolah</span>
            </h3>
            <form onSubmit={handleSaveBank} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  placeholder="mis. BNI"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-bank-name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  data-testid="input-bank-account"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pemilik</label>
                <input
                  type="text"
                  value={bankHolder}
                  onChange={(e) => setBankHolder(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
                  data-testid="input-bank-holder"
                />
              </div>
              <button
                type="submit"
                disabled={savingBank}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-xs"
                data-testid="btn-save-bank"
              >
                {savingBank ? 'Menyimpan…' : 'Simpan Rekening'}
              </button>
            </form>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden" data-testid="bank-account-list">
              {(bankAccounts ?? []).map((acc) => (
                <div key={acc.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{acc.bank}</p>
                    <p className="text-slate-500 font-mono text-[11px]">{acc.holder}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono font-bold text-slate-700">
                    {acc.account_masked}
                  </span>
                </div>
              ))}
              {bankAccounts !== null && bankAccounts.length === 0 && (
                <p className="p-3 text-xs text-slate-500">Belum ada rekening terdaftar.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: LAPORAN KAS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Laporan Arus Kas
            </h3>
            <form onSubmit={handleLoadReport} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  data-testid="input-report-from"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
                  data-testid="input-report-to"
                />
              </div>
              <button
                type="submit"
                disabled={loadingReport}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-xs"
                data-testid="btn-load-report"
              >
                {loadingReport ? 'Memuat…' : 'Tampilkan Laporan'}
              </button>
            </form>
          </div>

          {cashReport !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-semibold">Saldo Awal</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{formatRupiah(cashReport.opening)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
                <span className="text-xs text-emerald-700 font-semibold">Pemasukan</span>
                <p className="text-2xl font-black text-emerald-800 mt-1">{formatRupiah(cashReport.income)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
                <span className="text-xs text-rose-700 font-semibold">Pengeluaran</span>
                <p className="text-2xl font-black text-rose-800 mt-1">{formatRupiah(cashReport.expense)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-teal-200 bg-teal-50/20 shadow-xs">
                <span className="text-xs text-teal-700 font-semibold">Saldo Akhir</span>
                <p className="text-2xl font-black text-teal-900 mt-1">{formatRupiah(cashReport.closing)}</p>
              </div>
            </div>
          )}

          {cashReport !== null && (cashReport.by_account?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto" data-testid="cash-split">
              <div className="p-4 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Rincian per Kanal Dana (Kas vs Bank)</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pembayaran tunai & kas tanpa rekening masuk kanal Kas Tunai; sisanya melekat pada rekening.
                </p>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>
                    <th className="p-3">Kanal Dana</th>
                    <th className="p-3 text-right">Pemasukan</th>
                    <th className="p-3 text-right">Pengeluaran</th>
                    <th className="p-3 text-right">Saldo Awal</th>
                    <th className="p-3 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {(cashReport.by_account ?? []).map((row) => (
                    <tr key={row.id ?? 'kas'} className="border-t border-slate-100">
                      <td className="p-3 font-semibold text-slate-700">{row.label}</td>
                      <td className="p-3 text-right text-emerald-800">{formatRupiah(row.income)}</td>
                      <td className="p-3 text-right text-rose-800">{formatRupiah(row.expense)}</td>
                      <td className="p-3 text-right text-slate-600">{formatRupiah(row.opening)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatRupiah(row.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DISTRIBUTION MODAL */}
      <Modal
        isOpen={distributeItem !== null}
        onClose={() => setDistributeItem(null)}
        title="Distribusi Tagihan ke Kelas"
        subtitle={distributeItem ? `${distributeItem.name} — ${formatRupiah(distributeItem.amount)}` : ''}
        maxWidth="md"
        dataTestId="modal-distribute"
      >
        <form onSubmit={handleDistributeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kelas</label>
            <select
              value={distributeClassId}
              onChange={(e) => setDistributeClassId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
            >
              <option value="">Semua siswa</option>
              {classRooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Periode</label>
            <input
              type="text"
              value={distributePeriod}
              onChange={(e) => setDistributePeriod(e.target.value)}
              placeholder="mis. 2026-08"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
              data-testid="input-distribute-period"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDistributeItem(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={distributing}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-xs"
              data-testid="btn-distribute"
            >
              {distributing ? 'Mendistribusikan…' : 'Distribusikan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* OFFICIAL KWITANSI PRINT MODAL */}
      {selectedReceipt && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
          title="Kwitansi Resmi Pembayaran Sekolah"
          subtitle={`No. Bukti: ${selectedReceipt.receiptNumber}`}
          maxWidth="2xl"
          dataTestId="receipt-modal"
        >
          <div className="space-y-6">
            {/* Printable Receipt Paper */}
            <div className="p-8 bg-white border border-slate-300 rounded-2xl shadow-sm text-slate-900 space-y-6 select-none font-sans">
              {/* Receipt Header with School Emblem */}
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <Building className="w-10 h-10 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wide">
                      {schoolConfig.name}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      {schoolConfig.address} • NPSN: {schoolConfig.npsn}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-extrabold bg-slate-100 px-3 py-1 rounded border border-slate-200 block">
                    KWITANSI RESMI
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">{selectedReceipt.receiptNumber}</p>
                </div>
              </div>

              {/* Receipt Body Table */}
              <table className="w-full text-xs space-y-2">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500 w-36">Telah Terima Dari</td>
                    <td className="py-2 font-bold text-slate-900">
                      {selectedReceipt.studentName} ({selectedReceipt.nisn})
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Kelas / Jurusan</td>
                    <td className="py-2 font-semibold text-slate-800">{selectedReceipt.kelas}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Uang Sejumlah</td>
                    <td className="py-2 font-serif italic text-teal-950 font-bold bg-teal-50/50 p-2 rounded">
                      &ldquo;{terbilang(selectedReceipt.nominal)}&rdquo;
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-500">Untuk Pembayaran</td>
                    <td className="py-2 font-semibold text-slate-900">
                      Iuran SPP Pendidikan Bulan {selectedReceipt.month} — T.A {schoolConfig.academicYear}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Amount & Treasurer Signature */}
              <div className="flex items-end justify-between pt-4 border-t border-slate-200">
                <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl">
                  <span className="text-[10px] text-slate-500 block font-semibold">Jumlah Terbilang:</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    {formatRupiah(selectedReceipt.nominal)}
                  </span>
                </div>

                <div className="text-right text-xs space-y-0.5">
                  <p className="text-slate-500">Jakarta, {selectedReceipt.paidDate}</p>
                  <p className="text-slate-500">Bendahara Sekolah,</p>
                  <div className="h-10 flex items-center justify-end">
                    <span className="font-serif italic font-bold text-teal-800 underline">
                      Ibu Endang Sulistyo, S.E.
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-mono">NIP. 198004122006042008</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  window.print();
                  onShowToast('Cetak Kwitansi', 'Membuka dialog cetak browser kwitansi resmi.', 'info');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kwitansi Ini</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* NEW TRANSACTION FORM MODAL */}
      <Modal
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        title="Catat Transaksi Arus Kas Baru"
        subtitle="Pencatatan mutasi kas operasional sekolah (Buku Kas Umum)"
        maxWidth="md"
        dataTestId="new-transaction-modal"
      >
        <form onSubmit={handleNewTxSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jenis Transaksi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTxType('Pemasukan')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  txType === 'Pemasukan'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Pemasukan (Income)
              </button>
              <button
                type="button"
                onClick={() => setTxType('Pengeluaran')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  txType === 'Pengeluaran'
                    ? 'bg-rose-50 border-rose-500 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Pengeluaran (Expense)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori Transaksi</label>
            <input
              type="text"
              value={txCategory}
              onChange={(e) => setTxCategory(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nominal (Rupiah)</label>
            <input
              type="number"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              required
              min={1000}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Keterangan Transaksi</label>
            <textarea
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              required
              placeholder="Contoh: Pembelian tinta printer dan kertas HVS untuk TU"
              rows={3}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewTxModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs"
            >
              Simpan Transaksi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
