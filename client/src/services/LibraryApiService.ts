import { api } from '../lib/ApiClient';

export interface ServerBook {
  id: string;
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  year: number | null;
  category: string | null;
  physical_stock: number;
  page_count: number | null;
  summary: string | null;
  has_ebook: boolean;
  available: number;
  /** Link e-book bertanda tangan dari server (berlaku pendek). */
  ebook_url?: string | null;
}

export interface ServerLoan {
  id: string;
  book_id: string;
  student_id: string;
  borrowed_at: string;
  due_at: string | null;
  returned_at: string | null;
  status: string;
  book?: { id: string; title: string } | null;
  student?: { id: string; nisn: string; name: string } | null;
}

function unwrapPage<T>(res: { data: { data: { data?: T[] } | T[] } }): T[] {
  const page = res.data.data;
  return Array.isArray(page) ? page : page.data ?? [];
}

/** OOP client Perpustakaan. Tanpa token → katalog mock lokal. */
export class LibraryApiService {
  static async catalog(search = '', category = ''): Promise<ServerBook[]> {
    const res = await api.get('/library/books', { params: { search, category } });
    return unwrapPage<ServerBook>(res);
  }

  static async borrow(bookId: string): Promise<void> {
    await api.post(`/library/books/${bookId}/borrow`, {});
  }

  /** Tambah buku (petugas). Mendukung unggahan e-book opsional. */
  static async createBook(input: {
    title: string;
    author: string;
    publisher?: string;
    isbn?: string;
    year?: number;
    category?: string;
    physical_stock?: number;
    page_count?: number;
    summary?: string;
    ebook?: File | null;
  }): Promise<ServerBook> {
    const form = new FormData();
    form.append('title', input.title);
    form.append('author', input.author);
    if (input.publisher) form.append('publisher', input.publisher);
    if (input.isbn) form.append('isbn', input.isbn);
    if (input.year !== undefined) form.append('year', String(input.year));
    if (input.category) form.append('category', input.category);
    if (input.physical_stock !== undefined) form.append('physical_stock', String(input.physical_stock));
    if (input.page_count !== undefined) form.append('page_count', String(input.page_count));
    if (input.summary) form.append('summary', input.summary);
    if (input.ebook) form.append('ebook', input.ebook);

    const res = await api.post('/library/books', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as ServerBook;
  }

  /** Kembalikan pinjaman aktif. */
  static async returnLoan(loanId: string): Promise<void> {
    await api.post(`/library/loans/${loanId}/return`);
  }

  /** Daftar pinjaman (petugas) — sumber panel pengembalian. */
  static async loans(status?: 'borrowed' | 'returned' | 'late'): Promise<ServerLoan[]> {
    const res = await api.get('/library/loans', { params: status ? { status } : {} });
    return unwrapPage<ServerLoan>(res);
  }

  /** Unduh e-book via URL bertanda tangan dari server (`ebook_url`). */
  static async downloadEbook(ebookUrl: string, filename: string): Promise<void> {
    const res = await api.get(ebookUrl, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
