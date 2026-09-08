import React, { useState } from 'react';
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
import { formatRupiah, formatDate, terbilang, addAuditLog } from '../../../utils/helpers';

interface FinanceModuleProps {
  sppProfile: StudentSppProfile;
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
  const [activeTab, setActiveTab] = useState<'spp_matrix' | 'buku_kas' | 'pos_biaya'>('spp_matrix');
  const [sppProfile, setSppProfile] = useState<StudentSppProfile>(initialSpp);
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

  // Quick SPP Pay simulation for a specific month
  const handlePayMonth = (monthName: string) => {
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
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('spp_matrix')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'pos_biaya'
                ? 'bg-white text-teal-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-finance-pos"
          >
            Master Pos Biaya
          </button>
        </div>
      </div>

      {/* VIEW 1: 12-MONTH SPP MATRIX */}
      {activeTab === 'spp_matrix' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold">Total Tagihan Siswa</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{formatRupiah(sppProfile.totalTagihan)}</p>
              <p className="text-[11px] text-slate-400 mt-1">12 Bulan Tahun Pelajaran {schoolConfig.academicYear}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-xs text-emerald-700 font-semibold">Total Terbayar</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{formatRupiah(sppProfile.totalDibayar)}</p>
              <p className="text-[11px] text-emerald-600 mt-1">Telah diverifikasi oleh Bendahara</p>
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
              <span className="text-slate-400 font-medium">Siswa Terpilih: </span>
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
                        <div className="text-[10px] text-slate-400 font-mono leading-tight">
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
                        className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                        data-testid={`btn-pay-spp-${m.month}`}
                      >
                        Bayar Lunas (Simulasi)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              <ArrowUpRight className="w-8 h-8 text-emerald-600 bg-emerald-100 p-1.5 rounded-xl shrink-0" />
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
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                data-testid="btn-add-transaction"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Transaksi Baru</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Daftar Komponen & Pos Pembayaran Sekolah
            </h3>
            <span className="text-xs text-slate-400">Tahun Ajaran {schoolConfig.academicYear}</span>
          </div>

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
        </div>
      )}

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
                  <span className="text-[10px] text-slate-400 block font-semibold">Jumlah Terbilang:</span>
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
                  <p className="text-[9px] text-slate-400 font-mono">NIP. 198004122006042008</p>
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
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs flex items-center gap-1.5"
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
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              Simpan Transaksi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
