import { api } from '../lib/ApiClient';
import { API_BASE } from './OpsApiService';

export interface ServerPaymentItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  academic_year?: string | null;
  active: boolean;
}

export interface ServerInvoice {
  id: string;
  student_id: string;
  item_id: string | null;
  title: string;
  period: string | null;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date: string | null;
  item?: ServerPaymentItem | null;
}

export interface ServerSummary {
  total_tagihan: number;
  total_dibayar: number;
  sisa: number;
  invoices: ServerInvoice[];
}

export interface ServerPayment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  reference: string;
  receipt_number: string;
  paid_at: string;
}

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

/** OOP client Keuangan server-side (bendahara). Tanpa token → modul memakai mock lokal. */
export class FinanceApiService {
  static async items(): Promise<ServerPaymentItem[]> {
    const res = await api.get('/finance/items');
    const page = unwrap<{ data: ServerPaymentItem[] } | ServerPaymentItem[]>(res);
    return Array.isArray(page) ? page : page.data;
  }

  static async createItem(input: { name: string; category?: string; amount: number }): Promise<ServerPaymentItem> {
    const res = await api.post('/finance/items', input);
    return unwrap<ServerPaymentItem>(res);
  }

  static async invoices(studentId: string): Promise<ServerInvoice[]> {
    const res = await api.get('/finance/invoices', { params: { student_id: studentId } });
    const page = unwrap<{ data: ServerInvoice[] } | ServerInvoice[]>(res);
    return Array.isArray(page) ? page : page.data;
  }

  static async pay(
    invoiceId: string,
    input: { amount: number; method: string; reference: string },
  ): Promise<ServerPayment> {
    const res = await api.post(`/finance/invoices/${invoiceId}/payments`, input);
    return unwrap<ServerPayment>(res);
  }

  static async summary(studentId: string): Promise<ServerSummary> {
    const res = await api.get(`/finance/students/${studentId}/summary`);
    return unwrap<ServerSummary>(res);
  }

  static async distribute(
    itemId: string,
    input: { student_ids?: string[]; class_room_id?: string; period?: string; due_date?: string },
  ): Promise<{ created: number; skipped: number }> {
    const res = await api.post(`/finance/items/${itemId}/distribute`, input);
    return unwrap<{ created: number; skipped: number }>(res);
  }

  static async adjustInvoice(invoiceId: string, amount: number, reason: string): Promise<ServerPayment> {
    const res = await api.post(`/finance/invoices/${invoiceId}/adjust`, { amount, reason });
    return unwrap<ServerPayment>(res);
  }

  /** URL kwitansi PDF (cookie sesi ikut terkirim saat dibuka). */
  static receiptPdfUrl(paymentId: string): string {
    return `${API_BASE}/finance/payments/${paymentId}/receipt.pdf`;
  }

  static async bankAccounts(): Promise<ServerBankAccount[]> {
    const res = await api.get('/finance/bank-accounts');
    return unwrap<ServerBankAccount[]>(res);
  }

  static async createBankAccount(input: {
    bank: string;
    account_number: string;
    holder: string;
    active?: boolean;
  }): Promise<ServerBankAccount> {
    const res = await api.post('/finance/bank-accounts', input);
    return unwrap<ServerBankAccount>(res);
  }

  static async cash(params: { type?: 'income' | 'expense'; from?: string; to?: string } = {}): Promise<ServerCashTransaction[]> {
    const res = await api.get('/finance/cash', { params });
    const page = unwrap<{ data: ServerCashTransaction[] } | ServerCashTransaction[]>(res);
    return Array.isArray(page) ? page : page.data;
  }

  static async createCash(input: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    transaction_at: string;
    proof?: string;
    /** Kanal dana: rekening bank; kosong = kas tunai. */
    bank_account_id?: string | null;
  }): Promise<ServerCashTransaction> {
    const res = await api.post('/finance/cash', input);
    return unwrap<ServerCashTransaction>(res);
  }

  static async cashReport(from: string, to: string): Promise<ServerCashReport> {
    const res = await api.get('/finance/reports/cash', { params: { from, to } });
    return unwrap<ServerCashReport>(res);
  }
}

export interface ServerBankAccount {
  id: string;
  bank: string;
  account_masked: string;
  holder: string;
  active: boolean;
}

export interface ServerCashTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  transaction_at: string;
  proof: string | null;
  pic: string | null;
}

export interface ServerCashReport {
  from: string;
  to: string;
  income: number;
  expense: number;
  opening: number;
  closing: number;
  /** Pecahan per kanal dana: rekening bank + 'Kas Tunai' (id null). */
  by_account?: Array<{
    id: string | null;
    label: string;
    income: number;
    expense: number;
    opening: number;
    closing: number;
  }>;
}
