import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Library,
  Mail,
  MapPin,
  Menu,
  Phone,
  School,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { NewsPost, SchoolConfig } from '../../types';
import { Modal } from '../common/Modal';
import { CartoonStudents } from './CartoonStudents';
import { CmsApiService, SettingsApiService, ServerPost } from '../../services/OpsApiService';
import './landing.css';

interface PublicLandingPageProps {
  news: NewsPost[];
  schoolConfig: SchoolConfig;
  onGoToLogin: () => void;
  onGoToSpmb: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

// Foto lokal: /landing/school.jpg (aset repo). Fallback gradient bila file hilang.
const LOCAL_SCHOOL_PHOTO = '/landing/school.jpg';

const fallbackSchoolPhoto = LOCAL_SCHOOL_PHOTO;

const programs = [
  {
    title: 'Rekayasa perangkat lunak',
    detail: 'Membangun aplikasi, produk digital, dan solusi teknologi yang dipakai dunia nyata.',
    icon: BookOpen,
    tone: 'bg-[#dff6ef] text-[#0f766e]',
  },
  {
    title: 'Teknik komputer jaringan',
    detail: 'Menguasai infrastruktur jaringan, cloud, keamanan, dan sistem terdistribusi.',
    icon: Library,
    tone: 'bg-[#fff1c7] text-[#9a6700]',
  },
  {
    title: 'Desain komunikasi visual',
    detail: 'Mengolah ide menjadi visual, animasi, dan pengalaman komunikasi yang bermakna.',
    icon: Sparkles,
    tone: 'bg-[#ffe1db] text-[#b94739]',
  },
];

const stats = [
  { value: '1.080', label: 'siswa aktif', icon: Users },
  { value: '45+', label: 'mitra industri', icon: Trophy },
  { value: '100%', label: 'kelulusan', icon: CheckCircle2 },
];

const HERO_INTERVAL_MS = 6000;

/** Urutkan postingan: terbaru lebih dulu (ISO string). */
const byPublishedDesc = (a: ServerPost, b: ServerPost): number =>
  String(b.published_at ?? b.created_at).localeCompare(String(a.published_at ?? a.created_at));

/** Agenda berupa teks bebas atau array JSON; hasil selalu daftar baris siap tampil. */
const parseAgendaItems = (raw: string): string[] => {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              const record = item as Record<string, unknown>;
              const label = record.title ?? record.label ?? record.text ?? record.date;
              return typeof label === 'string' ? label : '';
            }
            return '';
          })
          .map((line) => line.trim())
          .filter(Boolean);
      }
    } catch {
      /* bukan JSON → perlakukan sebagai teks */
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);
};

interface SocialLink {
  label: string;
  url: string;
}

const toSocialLink = (item: unknown): SocialLink | null => {
  if (typeof item === 'string') {
    const [first, second] = item.split('|').map((part) => part.trim());
    const url = second || first;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    const fallbackLabel = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
    return { label: second ? first || fallbackLabel : fallbackLabel, url };
  }
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    const url = record.url ?? record.href ?? record.link;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      const label = record.label ?? record.name ?? record.title;
      return { label: typeof label === 'string' && label.trim() !== '' ? label : url, url };
    }
  }
  return null;
};

/** sosial media: JSON array/objek atau baris `Label|url`. */
const parseSocialLinks = (raw: string | null): SocialLink[] => {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Object.entries(parsed as Record<string, unknown>).map(([label, url]) => ({ label, url }));
      return list.map(toSocialLink).filter((link): link is SocialLink => link !== null);
    } catch {
      /* bukan JSON → perlakukan sebagai baris teks */
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map(toSocialLink)
    .filter((link): link is SocialLink => link !== null);
};

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  news,
  schoolConfig,
  onGoToLogin,
  onGoToSpmb,
  onShowToast,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsPost | null>(null);
  const [photoSrc, setPhotoSrc] = useState('/landing/school.jpg');
  const [serverNews, setServerNews] = useState<NewsPost[] | null>(null);
  const [banners, setBanners] = useState<ServerPost[]>([]);
  const [gallery, setGallery] = useState<ServerPost[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [landingSettings, setLandingSettings] = useState<Record<string, string | null>>({});

  // CMS publik: banner slider, galeri, dan berita dari postingan published server.
  useEffect(() => {
    let cancelled = false;
    void CmsApiService.posts()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        const ordered = [...list].sort(byPublishedDesc);
        setBanners(ordered.filter((p) => p.category === 'banner'));
        setGallery(ordered.filter((p) => p.category === 'galeri'));
        const newsPosts = ordered
          .filter((p) => p.category !== 'banner' && p.category !== 'galeri')
          .slice(0, 3);
        if (newsPosts.length === 0) return;
        setServerNews(
          newsPosts.map((p, i) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            category: p.category ?? 'Berita Sekolah',
            author: 'Humas Sekolah',
            publishedAt: String(p.published_at ?? p.created_at).slice(0, 10),
            readTime: '3 Menit',
            excerpt: p.excerpt ?? p.content.slice(0, 140),
            content: p.content,
            image: p.image_url ?? news[i]?.image ?? fallbackSchoolPhoto,
            tags: p.tags ?? [],
          }))
        );
      })
      .catch((error) => {
        console.warn('Konten CMS publik tidak tersedia; memakai konten statis.', error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profil/agenda/media sosial dari settings; key kosong tidak mengubah konten statis.
  useEffect(() => {
    let cancelled = false;
    void SettingsApiService.get()
      .then((values) => {
        if (!cancelled) setLandingSettings(values ?? {});
      })
      .catch((error) => {
        console.warn('Pengaturan halaman publik tidak tersedia; memakai konten statis.', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveSlide(0);
  }, [banners]);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % banners.length);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const settingText = (key: string): string | null => {
    const value = landingSettings[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  };

  const schoolProfile = settingText('school_profile');
  const headmasterGreeting = settingText('headmaster_greeting');
  const mapsEmbed = settingText('maps_embed');
  const agendaItems = parseAgendaItems(settingText('school_agenda') ?? '');
  const socialLinks = parseSocialLinks(settingText('social_links'));

  const goToSlide = (index: number) => {
    if (banners.length === 0) return;
    setActiveSlide(((index % banners.length) + banners.length) % banners.length);
  };

  const displayNews = serverNews ?? news;

  const closeMenu = () => setIsMenuOpen(false);

  const handlePhotoError = () => {
    // Gagal load → sembunyikan img, gradient CSS di belakang tetap tampil.
    setPhotoSrc('');
  };

  const handleAllNews = () => {
    onShowToast('Arsip berita', 'Konten berita lengkap akan tersedia melalui CMS sekolah.', 'info');
  };

  return (
    <div className="landing-page min-h-screen overflow-hidden" data-testid="public-landing-page">
      <a className="landing-skip-link" href="#main-content">
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-[#17324d]/10 bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-3" onClick={closeMenu}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#17324d] text-[#fff8e8] shadow-sm">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight text-[#17324d] sm:text-base" translate="no">
                {schoolConfig.name}
              </span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f766e] sm:block">
                Portal sekolah terpadu
              </span>
            </span>
          </a>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-7 lg:flex">
            <a className="text-sm font-semibold text-[#17324d]/70 transition-colors hover:text-[#0f766e]" href="#profil">
              Profil
            </a>
            <a className="text-sm font-semibold text-[#17324d]/70 transition-colors hover:text-[#0f766e]" href="#program">
              Program
            </a>
            <a className="text-sm font-semibold text-[#17324d]/70 transition-colors hover:text-[#0f766e]" href="#kegiatan">
              Kegiatan
            </a>
            <a className="text-sm font-semibold text-[#17324d]/70 transition-colors hover:text-[#0f766e]" href="#berita">
              Berita
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToLogin}
              className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#17324d] px-4 text-sm font-bold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453] sm:flex"
              data-testid="landing-login-button"
            >
              Masuk portal
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-[#17324d]/15 text-[#17324d] transition-colors hover:bg-[#dff6ef] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453] lg:hidden"
              aria-label={isMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={isMenuOpen}
              aria-controls="landing-mobile-menu"
            >
              {isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div id="landing-mobile-menu" className="border-t border-[#17324d]/10 bg-[#fffdf8] px-5 py-4 lg:hidden">
            <nav aria-label="Navigasi mobile" className="mx-auto flex max-w-7xl flex-col gap-1">
              {[
                ['Profil', '#profil'],
                ['Program', '#program'],
                ['Kegiatan', '#kegiatan'],
                ['Berita', '#berita'],
              ].map(([label, href]) => (
                <a key={href} href={href} onClick={closeMenu} className="flex min-h-11 items-center border-b border-[#17324d]/8 text-sm font-semibold text-[#17324d]">
                  {label}
                </a>
              ))}
              <button type="button" onClick={onGoToLogin} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17324d] px-4 text-sm font-bold text-white">
                Masuk portal <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </nav>
          </div>
        )}
      </header>

      <main id="main-content">
        <section id="top" className="relative mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <div className="relative z-10 max-w-2xl">
              <div className="landing-reveal inline-flex items-center gap-2 rounded-full border border-[#0f766e]/20 bg-[#dff6ef] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#0f766e]">
                <span className="size-2 rounded-full bg-[#ef6b5b]" aria-hidden="true" />
                Tahun ajaran {schoolConfig.academicYear}
              </div>
              <h1 className="landing-reveal landing-reveal-delay-1 mt-6 max-w-xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-[#17324d] sm:text-6xl lg:text-7xl">
                Belajar hari ini, membangun dunia esok.
              </h1>
              <p className="landing-reveal landing-reveal-delay-2 mt-6 max-w-xl text-base leading-7 text-[#17324d]/70 sm:text-lg">
                {schoolConfig.name} menyiapkan talenta vokasi yang berani mencoba, mampu bekerja bersama, dan siap memberi dampak melalui teknologi serta karakter.
              </p>
              <div className="landing-reveal landing-reveal-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onGoToSpmb}
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#c0392b] px-5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(192,57,43,0.22)] transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#a53125] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#17324d]"
                  data-testid="landing-register-button"
                >
                  Mulai pendaftaran
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <a
                  href="#profil"
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[#17324d]/20 bg-white/60 px-5 text-sm font-extrabold text-[#17324d] transition-colors hover:bg-[#dff6ef] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453]"
                >
                  Kenali sekolah
                  <ChevronRight className="size-4" aria-hidden="true" />
                </a>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-[#17324d]/80">
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#0f766e]" aria-hidden="true" /> Akreditasi {schoolConfig.akreditasi}</span>
                <span className="flex items-center gap-2"><School className="size-4 text-[#0f766e]" aria-hidden="true" /> NPSN {schoolConfig.npsn}</span>
              </div>
            </div>

            <div className="landing-reveal landing-reveal-delay-2 relative min-h-[370px] sm:min-h-[490px]">
              {banners.length > 0 ? (
                <div
                  className="landing-photo-frame landing-photo-arrive absolute inset-x-2 top-0 overflow-hidden rounded-[2rem] bg-[#17324d] shadow-[0_24px_55px_rgba(23,50,77,0.18)] sm:inset-x-4 sm:rounded-[2.5rem]"
                  data-testid="hero-slider"
                  aria-roledescription="carousel"
                  aria-label="Sorotan sekolah"
                >
                  <div className="relative aspect-[4/3] w-full">
                    {banners.map((slide, index) => (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-700 ${
                          index === activeSlide ? 'opacity-100' : 'pointer-events-none opacity-0'
                        }`}
                        data-testid={`hero-slide-${index}`}
                        aria-hidden={index !== activeSlide}
                      >
                        {slide.image_url ? (
                          <img
                            src={slide.image_url}
                            alt={slide.title}
                            className="size-full object-cover"
                            loading={index === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                          />
                        ) : (
                          <div className="size-full bg-gradient-to-br from-[#17324d] via-[#0f766e] to-[#17324d]" aria-hidden="true" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17324d]/95 via-[#17324d]/45 to-transparent p-5 pt-16 sm:p-8">
                          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f6c453]">Sorotan</p>
                          <p className="mt-2 text-lg font-black leading-tight text-white sm:text-2xl">{slide.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {banners.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => goToSlide(activeSlide - 1)}
                        aria-label="Slide sebelumnya"
                        data-testid="hero-slider-prev"
                        className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#17324d] shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f6c453]"
                      >
                        <ChevronLeft className="size-5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => goToSlide(activeSlide + 1)}
                        aria-label="Slide berikutnya"
                        data-testid="hero-slider-next"
                        className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#17324d] shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#f6c453]"
                      >
                        <ChevronRight className="size-5" aria-hidden="true" />
                      </button>
                      <div className="absolute right-5 top-5 flex items-center gap-2">
                        {banners.map((slide, index) => (
                          <button
                            key={slide.id}
                            type="button"
                            onClick={() => goToSlide(index)}
                            aria-label={`Buka slide ${index + 1}`}
                            aria-current={index === activeSlide}
                            data-testid={`hero-dot-${index}`}
                            className={`size-2.5 rounded-full transition-colors ${
                              index === activeSlide ? 'bg-[#f6c453]' : 'bg-white/50 hover:bg-white'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
              <div className="landing-photo-frame landing-photo-arrive absolute inset-x-2 top-0 overflow-visible sm:inset-x-4">
                {photoSrc !== '' && (
                <img
                  src={photoSrc}
                  alt="Ilustrasi gedung sekolah dengan jam dan bendera di bagian atas"
                  className="landing-hero-photo aspect-[4/3] w-full rounded-[2rem] object-cover object-center shadow-[0_24px_55px_rgba(23,50,77,0.18)] sm:rounded-[2.5rem]"
                  width="1400"
                  height="1050"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onError={handlePhotoError}
                />
                )}
                <div className="absolute -bottom-7 -left-3 max-w-[190px] rounded-2xl border border-white/70 bg-[#fff8e8]/95 p-4 shadow-[0_14px_30px_rgba(23,50,77,0.14)] backdrop-blur-sm sm:-left-8 sm:max-w-[220px]">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Ruang untuk tumbuh</p>
                  <p className="mt-2 text-sm font-bold leading-5 text-[#17324d]">Belajar terasa nyata ketika ide bertemu lingkungan yang mendukung.</p>
                </div>
              </div>
              )}
              <div className="absolute -bottom-5 right-0 z-10 w-[68%] max-w-[330px] sm:-bottom-7 sm:right-2">
                <CartoonStudents />
              </div>
              <div className="absolute -right-3 top-12 size-20 rounded-full bg-[#f6c453]/60 blur-2xl sm:size-32" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-[#17324d]/10 bg-[#17324d]/10 sm:grid-cols-3">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-4 bg-white px-5 py-5 sm:px-7">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#dff6ef] text-[#0f766e]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-2xl font-black tracking-tight text-[#17324d]">{value}</strong>
                  <span className="text-xs font-semibold text-[#17324d]/80">{label}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="profil" className="landing-anchor border-y border-[#17324d]/8 bg-[#17324d] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#f6c453]">Profil sekolah</p>
              <h2 className="mt-4 max-w-md text-3xl font-black leading-tight tracking-[-0.03em] sm:text-5xl">Tempat rasa ingin tahu berubah menjadi karya.</h2>
            </div>
            <div>
              <div className="grid gap-8 sm:grid-cols-2">
                <p className="max-w-xl whitespace-pre-line text-base leading-7 text-white/70">{schoolProfile ?? 'Kami menghubungkan pembelajaran berbasis proyek, pendampingan guru, dan pengalaman industri agar setiap siswa menemukan cara terbaik untuk ikut berkontribusi.'}</p>
                <div className="border-l border-white/20 pl-5">
                  <p className="text-sm font-bold text-white">Visi kami</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">Menjadi sekolah vokasi unggul yang menghasilkan lulusan berakhlak, adaptif, dan berkompetensi global.</p>
                </div>
              </div>
              {headmasterGreeting && (
                <div className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6" data-testid="landing-headmaster-greeting">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f6c453]">Sambutan kepala sekolah</p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/75">{headmasterGreeting}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="program" className="landing-anchor mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Program keahlian</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17324d] sm:text-5xl">Pilih jalur yang membuatmu ingin terus belajar.</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-[#17324d]/80">Kurikulum kami berangkat dari kebutuhan nyata, lalu memberi ruang untuk bereksperimen.</p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {programs.map(({ title, detail, icon: Icon, tone }) => (
              <article key={title} className="group border-t-2 border-[#17324d]/15 pt-5 transition-transform duration-200 hover:-translate-y-1">
                <div className={`flex size-12 items-center justify-center rounded-2xl ${tone}`}><Icon className="size-6" aria-hidden="true" /></div>
                <h3 className="mt-6 text-xl font-black leading-tight text-[#17324d]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#17324d]/80">{detail}</p>
                <button type="button" onClick={() => onShowToast('Program keahlian', `Detail ${title} akan tersedia di halaman program sekolah.`, 'info')} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-[#0f766e] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453]">
                  Lihat program <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="kegiatan" className="landing-anchor bg-[#fff1c7]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[2rem] bg-[#b23a2c] p-7 sm:p-10">
              <div className="absolute -right-10 -top-10 size-40 rounded-full border-[22px] border-white/15" aria-hidden="true" />
              <div className="relative max-w-lg">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">Kegiatan siswa</p>
                <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-white sm:text-5xl">Karya paling kuat lahir dari kerja bersama.</h2>
                <p className="mt-5 text-sm leading-6 text-white">Dari laboratorium hingga panggung lomba, siswa belajar menyampaikan ide, menerima umpan balik, dan menyelesaikan sesuatu yang bisa dibanggakan.</p>
                <div className="mt-8 flex flex-wrap gap-3 text-xs font-extrabold text-[#17324d]">
                  <span className="rounded-full bg-white px-3 py-2">Project based learning</span>
                  <span className="rounded-full bg-[#f6c453] px-3 py-2">Teaching factory</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#7c5500]">Satu ekosistem untuk siswa dan keluarga</p>
              <ul className="mt-6 space-y-5">
                {[
                  ['Jadwal dan materi', 'Semua yang diperlukan siswa tersedia dalam satu portal.'],
                  ['Presensi transparan', 'Orang tua mendapat informasi kehadiran dengan cepat.'],
                  ['Pendampingan terukur', 'Guru dan wali kelas dapat melihat perkembangan secara utuh.'],
                ].map(([title, detail]) => (
                  <li key={title} className="flex gap-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#0f766e]" aria-hidden="true" />
                    <span><strong className="block text-sm font-black text-[#17324d]">{title}</strong><span className="mt-1 block text-sm leading-6 text-[#17324d]/80">{detail}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {agendaItems.length > 0 && (
          <section id="agenda" className="landing-anchor mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24" data-testid="landing-agenda">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Agenda sekolah</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17324d] sm:text-5xl">Kegiatan yang menanti.</h2>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {agendaItems.map((item, index) => (
                <li key={`${index}-${item}`} className="flex gap-4 rounded-2xl border border-[#17324d]/10 bg-white p-5 shadow-[0_10px_30px_rgba(23,50,77,0.06)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1c7] text-[#9a6700]">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-bold leading-6 text-[#17324d]">{item}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {gallery.length > 0 && (
          <section id="galeri" className="landing-anchor border-y border-[#17324d]/8 bg-[#dff6ef]/40" data-testid="landing-gallery">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
              <div className="max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Galeri sekolah</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17324d] sm:text-5xl">Momen dari keseharian kami.</h2>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.map((item) => (
                  <figure key={item.id} className="group overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(23,50,77,0.08)]">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                    ) : (
                      <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#17324d]/5 text-[#0f766e]" aria-hidden="true">
                        <Sparkles className="size-8" />
                      </div>
                    )}
                    <figcaption className="px-4 py-3 text-sm font-black leading-5 text-[#17324d]">{item.title}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="berita" className="landing-anchor mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Warta sekolah</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17324d] sm:text-5xl">Cerita yang sedang bergerak.</h2>
            </div>
            <button type="button" onClick={handleAllNews} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-extrabold text-[#0f766e] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453] sm:self-auto">Lihat semua berita <ArrowRight className="size-4" aria-hidden="true" /></button>
          </div>
          {displayNews.length > 0 ? (
            <div className="mt-10 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
              <article className="group overflow-hidden rounded-[2rem] bg-[#17324d] text-white">
                <div className="grid h-full sm:grid-cols-2">
                  {displayNews[0].image !== '' ? (
                  <img src={displayNews[0].image} alt={displayNews[0].title} className="min-h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                  ) : (
                  <div className="flex min-h-64 w-full items-center justify-center bg-[#0f766e]/20" aria-hidden="true">
                    <GraduationCap className="size-16 text-[#f6c453]/70" />
                  </div>
                  )}
                  <div className="flex flex-col justify-between p-6 sm:p-8">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#f6c453]">{displayNews[0].category}</span>
                      <h3 className="mt-5 text-2xl font-black leading-tight">{displayNews[0].title}</h3>
                      <p className="mt-4 text-sm leading-6 text-white/65">{displayNews[0].excerpt}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedNews(displayNews[0])} className="mt-8 inline-flex min-h-11 items-center gap-2 self-start text-sm font-extrabold text-[#f6c453] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453]">Baca cerita <ArrowRight className="size-4" aria-hidden="true" /></button>
                  </div>
                </div>
              </article>
              <div className="grid gap-5">
                {displayNews.slice(1, 3).map((item) => (
                  <article key={item.id} className="flex gap-4 border-b border-[#17324d]/12 pb-5 last:border-0">
                    {item.image !== '' ? (
                    <img src={item.image} alt={item.title} className="size-28 shrink-0 rounded-2xl object-cover" loading="lazy" decoding="async" />
                    ) : (
                    <span className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-[#dff6ef] text-[#0f766e]" aria-hidden="true">
                      <BookOpen className="size-8" />
                    </span>
                    )}
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0f766e]">{item.category}</span>
                      <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-[#17324d]">{item.title}</h3>
                      <button type="button" onClick={() => setSelectedNews(item)} className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-extrabold text-[#0f766e]">Baca cerita <ChevronRight className="size-3.5" aria-hidden="true" /></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-[#17324d]/20 bg-white p-10 text-center">
              <CalendarDays className="mx-auto size-8 text-[#0f766e]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#17324d]">Belum ada berita yang dipublikasikan.</p>
              <p className="mt-1 text-sm text-[#17324d]/80">Cerita sekolah akan muncul di sini setelah editor menerbitkannya.</p>
            </div>
          )}
        </section>

        {mapsEmbed && (
          <section className="landing-anchor mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24">
            <div className="overflow-hidden rounded-[2rem] border border-[#17324d]/10 bg-white shadow-[0_14px_40px_rgba(23,50,77,0.08)]">
              <div className="px-6 py-6 sm:px-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Lokasi sekolah</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#17324d] sm:text-3xl">Temukan kampus kami.</h2>
              </div>
              <div
                className="w-full [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:border-0"
                data-testid="landing-maps"
                dangerouslySetInnerHTML={{ __html: mapsEmbed }}
              />
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#dff6ef] px-6 py-10 sm:px-12 sm:py-14">
            <div className="relative z-10 max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0f766e]">Mulai langkah berikutnya</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-[#17324d] sm:text-5xl">Punya pertanyaan? Mari bicara tentang masa depanmu.</h2>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onGoToSpmb} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17324d] px-5 text-sm font-extrabold text-white transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#0f766e] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453]">Daftar SPMB <ArrowRight className="size-4" aria-hidden="true" /></button>
                <a href={`tel:${schoolConfig.phone}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#17324d]/20 bg-white/60 px-5 text-sm font-extrabold text-[#17324d] hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f6c453]"><Phone className="size-4" aria-hidden="true" /> Hubungi sekolah</a>
              </div>
            </div>
            <div className="absolute -bottom-14 -right-6 w-64 opacity-80 sm:right-10 sm:w-80"><CartoonStudents /></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#17324d] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#f6c453] text-[#17324d]"><GraduationCap className="size-5" aria-hidden="true" /></span><strong className="text-base" translate="no">{schoolConfig.name}</strong></div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">Sistem informasi akademik dan LMS terpadu untuk membantu sekolah bergerak lebih transparan, dekat, dan relevan.</p>
          </div>
          <div>
            <h2 className="text-sm font-black">Kunjungi kami</h2>
            <div className="mt-4 space-y-3 text-sm text-white/65"><p className="flex gap-3"><MapPin className="size-4 shrink-0 text-[#f6c453]" aria-hidden="true" /> {schoolConfig.address}, {schoolConfig.city}</p><p className="flex gap-3"><Phone className="size-4 shrink-0 text-[#f6c453]" aria-hidden="true" /> {schoolConfig.phone}</p><p className="flex gap-3"><Mail className="size-4 shrink-0 text-[#f6c453]" aria-hidden="true" /> {schoolConfig.email}</p></div>
          </div>
          <div>
            <h2 className="text-sm font-black">Tautan cepat</h2>
            <div className="mt-4 flex flex-col items-start gap-2 text-sm text-white/65"><button type="button" onClick={onGoToSpmb} className="min-h-9 hover:text-[#f6c453]">Pendaftaran SPMB</button><button type="button" onClick={onGoToLogin} className="min-h-9 hover:text-[#f6c453]">Portal akademik</button><a href="#top" className="min-h-9 pt-2 hover:text-[#f6c453]">Kembali ke atas</a></div>
          </div>
        </div>
        {socialLinks.length > 0 && (
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 border-t border-white/10 px-5 py-5 sm:px-8" data-testid="landing-social">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Media sosial</span>
            {socialLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-9 items-center rounded-full border border-white/20 px-3 text-xs font-bold text-white/85 transition-colors hover:border-[#f6c453] hover:text-[#f6c453]"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/70 sm:px-8">© 2026 {schoolConfig.name}. Semua hak dilindungi.</div>
      </footer>

      {selectedNews && (
        <Modal isOpen title={selectedNews.title} subtitle={`${selectedNews.category} · ${selectedNews.publishedAt}`} onClose={() => setSelectedNews(null)} maxWidth="2xl" dataTestId="landing-news-modal">
          <div className="space-y-5">
            {selectedNews.image !== '' && (
            <img src={selectedNews.image} alt={selectedNews.title} className="aspect-video w-full rounded-2xl object-cover" />
            )}
            <p className="text-sm leading-7 text-slate-700">{selectedNews.content}</p>
            <div className="flex justify-end"><button type="button" onClick={() => setSelectedNews(null)} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200">Tutup berita</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
};
