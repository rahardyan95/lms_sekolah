import React, { useState } from 'react';
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
} from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';

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

  // Filter books
  const filteredBooks = books.filter((b) => {
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
          TOTAL KOLEKSI: {books.length} JUDUL
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
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  src={book.coverImage}
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
                <p className="text-[10px] text-slate-400 font-mono">ISBN: {book.isbn}</p>

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
              <span className="text-slate-400 font-mono text-[11px]">{book.pageCount} Halaman</span>
              <button
                onClick={() => openPdfReader(book)}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                data-testid={`btn-read-ebook-${book.id}`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Baca E-Book</span>
              </button>
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
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-200 pb-3 font-mono">
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
                <div className="text-center text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-3">
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
    </div>
  );
};
