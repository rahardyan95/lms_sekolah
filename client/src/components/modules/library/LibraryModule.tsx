import React, { useState, useEffect } from 'react';
import { LibraryBook } from '../../../types';
import {
  BookOpen,
  Search,
  Filter,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  Bookmark,
  BookMarked,
  ShieldCheck,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { LibraryApiService, type ServerLoan } from '../../../services/LibraryApiService';
import { AuthService } from '../../../services/AuthService';
import { TokenStorage } from '../../../services/TokenStorage';
import { libraryCover } from '../../../utils/helpers';

interface LibraryModuleProps {
  books: LibraryBook[];
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const LibraryModule: React.FC<LibraryModuleProps> = ({ books, onShowToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // In-Browser PDF Reader Modal State
  const [readingBook, setReadingBook] = useState<LibraryBook | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Server-first: katalog dari API bila login; reset saat pencarian berubah.
  const [serverBooks, setServerBooks] = useState<LibraryBook[] | null>(null);
  // Penanda refresh manual katalog (setelah tambah buku / pengembalian).
  const [catalogueRefresh, setCatalogueRefresh] = useState(0);

  // Panel petugas perpustakaan (peran dari server, bukan metadata UI).
  const [canManageLibrary, setCanManageLibrary] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSavingBook, setIsSavingBook] = useState(false);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    stock: '1',
  });
  const [activeLoans, setActiveLoans] = useState<ServerLoan[]>([]);
  const [loansError, setLoansError] = useState(false);
  const [returningLoanId, setReturningLoanId] = useState<string | null>(null);
  const [loansRefresh, setLoansRefresh] = useState(0);

  useEffect(() => {
    if (!TokenStorage.hasSession()) return;
    let cancelled = false;
    void AuthService.profile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setCanManageLibrary(['super_admin', 'admin_tu'].includes(profile.role));
      })
      .catch(() => {
        /* profil gagal → panel petugas tersembunyi (server tetap menolak 403) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canManageLibrary || !TokenStorage.hasSession()) {
      setActiveLoans([]);
      return;
    }
    let cancelled = false;
    setLoansError(false);
    void LibraryApiService.loans('borrowed')
      .then((list) => {
        if (!cancelled) setActiveLoans(list);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveLoans([]);
        setLoansError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageLibrary, loansRefresh]);

  useEffect(() => {
    if (!TokenStorage.hasSession()) {
      setServerBooks(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void LibraryApiService.catalog(searchQuery)
        .then((list) => {
          if (cancelled) return;
          setServerBooks(
            list.map((b) => ({
              id: b.id,
              title: b.title,
              author: b.author,
              publisher: b.publisher ?? '-',
              isbn: b.isbn ?? '-',
              year: b.year ?? 0,
              category: b.category ?? 'Umum',
              physicalStock: b.physical_stock,
              availableStock: b.available,
              hasEbook: b.has_ebook,
              pageCount: b.page_count ?? 0,
              coverImage: libraryCover(b.title, b.id),
              summary: b.summary ?? '',
              ebookUrl: b.ebook_url ?? null,
            }))
          );
        })
        .catch(() => {
          if (!cancelled) setServerBooks(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, catalogueRefresh]);

  const displayBooks = serverBooks ?? books;

  // Filter books
  const filteredBooks = displayBooks.filter((b) => {
    const matchesCategory = selectedCategory === 'Semua' || b.category === selectedCategory;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const categories = ['Semua', 'Teknologi & RPL', 'Teknik Komputer & Jaringan', 'Desain & Seni', 'Umum'];

  const openPdfReader = (book: LibraryBook) => {
    setReadingBook(book);
    setCurrentPage(1);
    setZoomLevel(100);
    onShowToast('Membuka E-Book', `Membuka buku digital "${book.title}" langsung di browser tanpa unduhan.`, 'info');
  };

  // Petugas: simpan buku baru lalu segarkan katalog dari server.
  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = bookForm.title.trim();
    const author = bookForm.author.trim();
    if (!title || !author) {
      onShowToast('Data Belum Lengkap', 'Judul dan pengarang wajib diisi.', 'warning');
      return;
    }
    setIsSavingBook(true);
    try {
      await LibraryApiService.createBook({
        title,
        author,
        isbn: bookForm.isbn.trim() || undefined,
        category: bookForm.category.trim() || undefined,
        physical_stock: Number.parseInt(bookForm.stock, 10) || 0,
      });
      onShowToast('Buku Ditambahkan', `"${title}" tersimpan di katalog.`, 'success');
      setBookForm({ title: '', author: '', isbn: '', category: '', stock: '1' });
      setCreateModalOpen(false);
      setCatalogueRefresh((n) => n + 1);
    } catch {
      onShowToast('Gagal Menyimpan', 'Server menolak data buku baru.', 'error');
    } finally {
      setIsSavingBook(false);
    }
  };

  // Petugas: kembalikan pinjaman aktif, lalu segarkan daftar + stok katalog.
  const handleReturnLoan = async (loan: ServerLoan) => {
    setReturningLoanId(loan.id);
    try {
      await LibraryApiService.returnLoan(loan.id);
      onShowToast(
        'Buku Dikembalikan',
        `"${loan.book?.title ?? 'Buku'}" telah kembali ke rak.`,
        'success'
      );
      setLoansRefresh((n) => n + 1);
      setCatalogueRefresh((n) => n + 1);
    } catch {
      onShowToast('Pengembalian Gagal', 'Server tidak merespons permintaan ini.', 'error');
    } finally {
      setReturningLoanId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="library-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            <span>Perpustakaan Digital (E-Book & Buku Fisik)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Katalog terpadu literatur akademik dengan pembaca buku digital (PDF Reader) langsung di peramban
          </p>
        </div>

        <span className="px-3.5 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold font-mono">
          TOTAL KOLEKSI: {displayBooks.length} JUDUL{serverBooks !== null ? ' · LIVE API' : ''}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, pengarang, ISBN..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            data-testid="input-search-books"
          />
        </div>
      </div>

      {/* Kelola Koleksi — panel petugas (peran dari server) */}
      {canManageLibrary && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs" data-testid="library-manage-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-teal-600" />
                <span>Kelola Koleksi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tambah koleksi baru dan proses pengembalian pinjaman aktif.
              </p>
            </div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              data-testid="btn-open-create-book"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Buku</span>
            </button>
          </div>

          <div className="p-5">
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide font-mono">
              Peminjaman Aktif ({activeLoans.length})
            </h4>
            {activeLoans.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                {loansError
                  ? 'Gagal memuat daftar pinjaman aktif dari server.'
                  : 'Tidak ada pinjaman aktif saat ini.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {activeLoans.map((loan) => (
                  <li
                    key={loan.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {loan.book?.title ?? 'Buku'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {loan.student?.name ?? 'Siswa'} · NISN {loan.student?.nisn ?? '-'} · Jatuh tempo:{' '}
                        {loan.due_at ? new Date(loan.due_at).toLocaleDateString('id-ID') : '-'}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleReturnLoan(loan)}
                      disabled={returningLoanId === loan.id}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                      data-testid={`btn-return-${loan.id.slice(0, 8)}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{returningLoanId === loan.id ? 'Memproses...' : 'Kembalikan'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBooks.map((book) => (
          <div
            key={book.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-teal-300 transition-all group"
          >
            <div className="p-5 flex gap-4">
              {/* Cover Image */}
              <div className="w-24 h-32 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs">
                <img
                  src={book.coverImage !== '' ? book.coverImage : libraryCover(book.title, book.id)}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Book Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase tracking-wider font-mono">
                  {book.category}
                </span>
                <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                  {book.title}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">{book.author}</p>
                <p className="text-[10px] text-slate-500 font-mono">ISBN: {book.isbn}</p>

                {/* Stock Badges */}
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Stok: {book.availableStock} / {book.physicalStock}
                  </span>
                  {book.hasEbook && (
                    <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      E-Book Tersedia
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Excerpt */}
            <div className="px-5 pb-3">
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                {book.summary}
              </p>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono text-[11px]">{book.pageCount} Halaman</span>
              <div className="flex items-center gap-2">
                {serverBooks !== null && book.hasEbook && (
                  <button
                    onClick={() => {
                      if (!book.ebookUrl) {
                        onShowToast('E-Book Tidak Tersedia', 'Link unduh belum tersedia dari server.', 'error');
                        return;
                      }
                      void LibraryApiService.downloadEbook(book.ebookUrl, `${book.title}.pdf`)
                        .then(() => onShowToast('E-Book Diunduh', `Berkas "${book.title}" dari server.`, 'success'))
                        .catch(() => onShowToast('Unduh Gagal', 'Server tidak merespons.', 'error'));
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Server</span>
                  </button>
                )}
                {serverBooks !== null ? (
                  <button
                    onClick={() => {
                      void LibraryApiService.borrow(book.id)
                        .then(() => onShowToast('Peminjaman Berhasil', `"${book.title}" tercatat 14 hari.`, 'success'))
                        .catch(() => onShowToast('Peminjaman Gagal', 'Stok habis atau sudah dipinjam.', 'error'));
                    }}
                    className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    data-testid={`btn-borrow-${book.id.slice(0, 8)}`}
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>Pinjam</span>
                  </button>
                ) : (
                  <button
                    onClick={() => openPdfReader(book)}
                    className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                    data-testid={`btn-read-ebook-${book.id}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Baca E-Book</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* IN-BROWSER PDF READER VIEWER MODAL */}
      {readingBook && (
        <Modal
          isOpen={true}
          onClose={() => setReadingBook(null)}
          title={`E-Book Reader: ${readingBook.title}`}
          subtitle={`${readingBook.author} — ${readingBook.publisher} (${readingBook.year})`}
          maxWidth="4xl"
          dataTestId="pdf-reader-modal"
        >
          <div className="space-y-4">
            {/* Reader Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              {/* Page Controls */}
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 rounded-lg bg-white border border-slate-300 disabled:opacity-40 text-slate-700 hover:bg-slate-50"
                  aria-label="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono font-semibold text-slate-800">
                  Halaman {currentPage} dari {readingBook.pageCount}
                </span>
                <button
                  disabled={currentPage >= readingBook.pageCount}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-white border border-slate-300 disabled:opacity-40 text-slate-700 hover:bg-slate-50"
                  aria-label="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 15, 70))}
                  className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-slate-700 text-xs font-semibold">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 15, 150))}
                  className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Security watermark badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Watermark Digital: Lisensi Perpustakaan SMKN 1</span>
              </div>
            </div>

            {/* Simulated PDF Canvas Document */}
            <div className="bg-slate-300/60 p-4 sm:p-8 rounded-2xl border border-slate-300 min-h-[420px] flex items-center justify-center overflow-auto">
              <div
                className="bg-white shadow-2xl rounded-lg p-8 sm:p-12 transition-all max-w-2xl w-full border border-slate-200 space-y-6 select-none"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                {/* Simulated book page header */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-200 pb-3 font-mono">
                  <span>{readingBook.title}</span>
                  <span>Bab {currentPage} • Halaman {currentPage}</span>
                </div>

                {/* Simulated Book Body Text */}
                <div className="space-y-4 text-xs text-slate-800 leading-relaxed font-serif">
                  <h4 className="text-base font-bold font-sans text-slate-900">
                    Bab {currentPage}: Landasan Konseptual & Penerapan Nyata
                  </h4>
                  <p className="indent-6 text-justify">
                    Prinsip perancangan sistem modern menuntut modularitas tinggi, isolasi batas domain yang tegas, dan dependensi terarah ke inti bisnis. Ketika komponen arsitektur dipisahkan secara disiplin, proses refactoring, pengujian unit, serta perluasan skala dapat dijalankan tanpa menimbulkan efek samping yang tidak terduga pada modul lainnya.
                  </p>
                  <p className="indent-6 text-justify">
                    Dalam ekosistem sekolah vokasi (SMK), penerapan teori ini diwujudkan melalui kurikulum berbasis proyek nyata (Project-Based Learning). Setiap siswa dilatih membangun arsitektur perangkat lunak yang andal, aman, dan siap diproduksi di industri, mulai dari pemodelan basis data terdistribusi hingga implementasi antarmuka yang ramah pengguna.
                  </p>
                  <div className="p-4 bg-slate-50 border-l-4 border-teal-500 rounded-r-lg font-sans text-[11px] text-slate-700 italic">
                    &ldquo;Desain yang baik bukan sekadar tentang estetika permukaan, melainkan kejelasan struktur dan kemudahan sistem untuk beradaptasi dengan masa depan.&rdquo;
                  </div>
                </div>

                {/* Page Footer */}
                <div className="text-center text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-3">
                  — {currentPage} —
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReadingBook(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup Pembaca E-Book
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* MODAL TAMBAH BUKU (PETUGAS) */}
      {canManageLibrary && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Tambah Koleksi Buku"
          subtitle="Data buku baru akan langsung tampil di katalog."
          maxWidth="lg"
          dataTestId="modal-create-book"
        >
          <form onSubmit={(e) => void handleCreateBook(e)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700" htmlFor="book-title">
                Judul Buku
              </label>
              <input
                id="book-title"
                type="text"
                value={bookForm.title}
                onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Contoh: Pemrograman Web Modern"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                data-testid="input-book-title"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700" htmlFor="book-author">
                Pengarang
              </label>
              <input
                id="book-author"
                type="text"
                value={bookForm.author}
                onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
                placeholder="Nama pengarang"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                data-testid="input-book-author"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="book-isbn">
                  ISBN
                </label>
                <input
                  id="book-isbn"
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))}
                  placeholder="978-... (opsional)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  data-testid="input-book-isbn"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="book-category">
                  Kategori
                </label>
                <input
                  id="book-category"
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Contoh: Umum"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  data-testid="input-book-category"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700" htmlFor="book-stock">
                Jumlah Stok Fisik
              </label>
              <input
                id="book-stock"
                type="number"
                min={0}
                value={bookForm.stock}
                onChange={(e) => setBookForm((f) => ({ ...f, stock: e.target.value }))}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                data-testid="input-book-stock"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingBook}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                data-testid="btn-create-book"
              >
                {isSavingBook ? 'Menyimpan...' : 'Simpan Buku'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
