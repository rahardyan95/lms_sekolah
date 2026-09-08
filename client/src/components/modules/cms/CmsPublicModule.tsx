import React, { useState } from 'react';
import { NewsPost, SchoolConfig } from '../../../types';
import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  Award,
  Users,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Image as ImageIcon,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { Modal } from '../../common/Modal';

interface CmsPublicModuleProps {
  news: NewsPost[];
  schoolConfig: SchoolConfig;
  onGoToLogin: () => void;
  onGoToSpmb: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const CmsPublicModule: React.FC<CmsPublicModuleProps> = ({
  news,
  schoolConfig,
  onGoToLogin,
  onGoToSpmb,
  onShowToast,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedNews, setSelectedNews] = useState<NewsPost | null>(null);

  const heroSlides = [
    {
      badge: 'PPDB TAHUN AJARAN 2026/2027',
      title: 'Membangun Generasi Vokasi Unggul, Mandiri & Berdaya Saing Global',
      subtitle:
        'Pusat keunggulan pendidikan kejuruan teknologi dan rekayasa dengan kurikulum terintegrasi sertifikasi industri internasional.',
      ctaPrimary: 'Daftar SPMB Online',
      ctaSecondary: 'Jelajahi Jurusan',
      image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
    },
    {
      badge: 'PRESTASI TINGKAT NASIONAL',
      title: 'Raih Medali Emas LKS Nasional 2026 Bidang Cyber Security & Web',
      subtitle:
        'Komitmen SMKN 1 Jakarta dalam melahirkan talenta digital berkualitas tinggi yang siap diserap langsung oleh industri tier-1.',
      ctaPrimary: 'Lihat Prestasi',
      ctaSecondary: 'Profil Sekolah',
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
    },
  ];

  const galleryImages = [
    {
      title: 'Laboratorium Praktik Jaringan Komputer & Fiber Optic',
      category: 'Fasilitas',
      url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80',
    },
    {
      title: 'Studio Multimedia & Animasi Komputasi Visual',
      category: 'Fasilitas',
      url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&auto=format&fit=crop&q=80',
    },
    {
      title: 'Upacara Peringatan Hari Kemerdekaan & Prestasi Siswa',
      category: 'Kegiatan',
      url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=500&auto=format&fit=crop&q=80',
    },
    {
      title: 'Perpustakaan Modern & Digital Learning Hub',
      category: 'Sarana',
      url: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777f?w=500&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <div className="space-y-16 pb-12" data-testid="cms-public-module">
      {/* 1. HERO SLIDER BANNER */}
      <section className="relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950 text-white min-h-[480px] flex items-center">
        {/* Background Image with Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroSlides[activeSlide].image}
            alt="Hero Background"
            className="w-full h-full object-cover opacity-25 filter blur-xs scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 p-8 sm:p-14 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-bold font-mono tracking-wide">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>{heroSlides[activeSlide].badge}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {heroSlides[activeSlide].title}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl font-normal">
            {heroSlides[activeSlide].subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onGoToSpmb}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 text-xs transition-all flex items-center gap-2"
              data-testid="hero-btn-spmb"
            >
              <span>{heroSlides[activeSlide].ctaPrimary}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onGoToLogin}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold rounded-xl text-xs backdrop-blur-md transition-all flex items-center gap-2"
              data-testid="hero-btn-portal"
            >
              <span>Masuk Portal Akademik</span>
              <GraduationCap className="w-4 h-4 text-teal-300" />
            </button>
          </div>
        </div>

        {/* Slider Indicator Arrows */}
        <div className="absolute bottom-6 right-8 z-10 flex items-center gap-2">
          <button
            onClick={() => setActiveSlide((prev) => (prev === 0 ? heroSlides.length - 1 : prev - 1))}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-colors"
            aria-label="Slide sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveSlide((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1))}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-colors"
            aria-label="Slide berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 2. STATS BAR */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center space-y-1">
          <p className="text-3xl font-black text-teal-700">1.080</p>
          <p className="text-xs font-semibold text-slate-500">Siswa Aktif Terdaftar</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center space-y-1">
          <p className="text-3xl font-black text-slate-900">100%</p>
          <p className="text-xs font-semibold text-slate-500">Tingkat Kelulusan</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center space-y-1">
          <p className="text-3xl font-black text-teal-700">45+</p>
          <p className="text-xs font-semibold text-slate-500">Mitra Industri Nasional</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center space-y-1">
          <p className="text-3xl font-black text-slate-900">A</p>
          <p className="text-xs font-semibold text-slate-500">Akreditasi Unggul (BAN-SM)</p>
        </div>
      </section>

      {/* 3. SAMBUTAN KEPALA SEKOLAH & PROFIL */}
      <section className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 text-center">
            <div className="w-44 h-52 rounded-2xl overflow-hidden border-2 border-teal-500 shadow-lg mx-auto bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80"
                alt={schoolConfig.headmaster}
                className="w-full h-full object-cover"
              />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-3">{schoolConfig.headmaster}</h4>
            <p className="text-[11px] text-teal-700 font-semibold">Kepala Sekolah {schoolConfig.name}</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIP. {schoolConfig.headmasterNip}</p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider font-mono">
              Sambutan Kepala Sekolah
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              Transformasi Digital Menuju Sekolah Vokasi Berkelas Dunia
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              &ldquo;Assalamu’alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi {schoolConfig.name}. Melalui implementasi SIAKAD & LMS Terpadu berbasis Kurikulum Merdeka, kami berkomitmen menghadirkan ekosistem pembelajaran yang transparan, efisien, dan adaptif terhadap revolusi industri 4.0. Seluruh stakeholder—siswa, dewan guru, dan orang tua—kini saling terhubung dalam satu genggaman.&rdquo;
            </p>

            {/* Visi Misi Quick Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-800">Visi Sekolah:</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Menjadi lembaga pendidikan vokasi unggul yang menghasilkan lulusan berakhlak mulia, berjiwa wirausaha, dan berkompetensi standar industri global.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-800">Misi Utama:</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Menyelenggarakan pembelajaran berbasis proyek (PjBL), memperluas kerjasama industri, dan membudayakan literasi digital etis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BERITA & ARTIKEL RESMI SEKOLAH */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider font-mono">
              Warta & Agenda Sekolah
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Berita Terkini & Informasi Kegiatan</h2>
          </div>
          <button
            onClick={() => onShowToast('Semua Berita', 'Menampilkan seluruh arsip warta sekolah.', 'info')}
            className="text-xs text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1"
          >
            <span>Lihat Semua Berita</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {news.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-teal-300 transition-all group"
            >
              <div>
                <div className="aspect-video w-full bg-slate-100 overflow-hidden relative">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold font-mono">
                    {item.category}
                  </span>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.publishedAt}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {item.readTime}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {item.excerpt}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-1">
                <button
                  onClick={() => setSelectedNews(item)}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  data-testid={`btn-read-news-${item.id}`}
                >
                  <span>Baca Selengkapnya</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 5. DOKUMENTASI & GALERI FOTO KEGIATAN */}
      <section className="space-y-6">
        <div>
          <span className="text-xs font-bold text-teal-700 uppercase tracking-wider font-mono">
            Galeri Sekolah
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Dokumentasi Sarana & Prestasi Siswa</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {galleryImages.map((img, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs group hover:border-teal-300 transition-all"
            >
              <div className="aspect-video overflow-hidden relative">
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                  {img.category}
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{img.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. KONTAK RESMI & FOOTER SEKOLAH */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <GraduationCap className="w-6 h-6 text-teal-400" />
              <span>{schoolConfig.name}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lembaga Pendidikan Kejuruan Vokasi Terakreditasi A (Unggul) dengan dukungan sarana komputasi terdistribusi dan teaching factory modern.
            </p>
            <p className="text-xs text-teal-400 font-mono">NPSN: {schoolConfig.npsn}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Informasi Kontak & Layanan
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{schoolConfig.address}, {schoolConfig.city}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-mono">{schoolConfig.phone}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{schoolConfig.email}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tautan Cepat Layanan
            </h4>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p>
                <button onClick={onGoToSpmb} className="hover:text-teal-300 transition-colors">
                  • Pendaftaran Calon Siswa (PPDB Online)
                </button>
              </p>
              <p>
                <button onClick={onGoToLogin} className="hover:text-teal-300 transition-colors">
                  • Portal Akademik Siswa & Guru
                </button>
              </p>
              <p>
                <button onClick={onGoToLogin} className="hover:text-teal-300 transition-colors">
                  • Portal Monitoring Orang Tua
                </button>
              </p>
              <p>
                <a href="#perpustakaan" className="hover:text-teal-300 transition-colors">
                  • Perpustakaan Digital & E-Book
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 {schoolConfig.name}. Seluruh Hak Cipta Dilindungi Undang-Undang.</span>
          <span className="font-mono text-[11px] text-teal-400">SIAKAD & LMS Terpadu v1.1</span>
        </div>
      </section>

      {/* FULL ARTICLE READER MODAL */}
      {selectedNews && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedNews(null)}
          title={selectedNews.title}
          subtitle={`Dipublikasikan oleh ${selectedNews.author} pada ${selectedNews.publishedAt}`}
          maxWidth="2xl"
          dataTestId="news-reader-modal"
        >
          <div className="space-y-4">
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100">
              <img
                src={selectedNews.image}
                alt={selectedNews.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {selectedNews.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="text-xs text-slate-800 leading-relaxed space-y-3 pt-2 text-justify">
              <p>{selectedNews.content}</p>
              <p>
                Kepala Sekolah memberikan apresiasi setinggi-tingginya kepada seluruh pembimbing dan siswa atas kerja keras yang tidak kenal lelah. Prestasi ini diharapkan dapat menjadi motivasi bagi adik-adik kelas untuk terus berkarya dan berprestasi di kancah nasional maupun internasional.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedNews(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Tutup Berita
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
