import QRCode from 'qrcode';

import { AuditLog } from '../types';

/** Avatar inisial (data-URI SVG, offline) — dipakai bila user tidak punya foto. */
export function initialsAvatar(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#0f766e"/><text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#ffffff">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Cover buku deterministik lokal (inisial + hue stabil) — tanpa hotlink eksternal. */
export function libraryCover(title: string, seed: string): string {
  let h = 0;
  for (const ch of `${seed}:${title}`) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || 'BK';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400'><rect width='300' height='400' fill='hsl(${h},45%,26%)'/><rect x='16' y='16' width='268' height='368' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='3'/><text x='150' y='190' font-family='sans-serif' font-size='72' font-weight='bold' fill='rgba(255,255,255,0.92)' text-anchor='middle'>${initials}</text><text x='150' y='340' font-family='sans-serif' font-size='20' fill='rgba(255,255,255,0.75)' text-anchor='middle'>PERPUSTAKAAN</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Tanggal hari ini di zona perangkat, format YYYY-MM-DD.
 * Dipakai untuk presensi hari berjalan — bukan tanggal filter tampilan
 * (yang bisa menunjuk hari lain dan ditolak server).
 */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatTime(timeString: string): string {
  return timeString.length === 5 ? `${timeString} WIB` : timeString;
}

export function maskSensitive(
  value: string,
  type: 'nik' | 'phone' | 'password' | 'nisn'
): string {
  if (!value) return '';
  if (type === 'password') {
    return '••••••••';
  }
  if (type === 'nik') {
    // Show first 6 and last 4, mask middle: 317101******0002
    if (value.length >= 12) {
      return `${value.slice(0, 6)}******${value.slice(-4)}`;
    }
    return '**************';
  }
  if (type === 'phone') {
    // Show first 4 and last 3: 0812****789
    if (value.length >= 8) {
      return `${value.slice(0, 4)}****${value.slice(-3)}`;
    }
    return '0812********';
  }
  if (type === 'nisn') {
    // Show first 4 and last 3: 0071***384
    if (value.length >= 7) {
      return `${value.slice(0, 4)}***${value.slice(-3)}`;
    }
    return value;
  }
  return value;
}

// Convert numbers to Indonesian words for official school receipts (Kwitansi)
export function terbilang(nominal: number): string {
  const bilangan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function toWords(n: number): string {
    if (n < 12) {
      return bilangan[n];
    } else if (n < 20) {
      return `${toWords(n - 10)} Belas`;
    } else if (n < 100) {
      return `${toWords(Math.floor(n / 10))} Puluh ${toWords(n % 10)}`.trim();
    } else if (n < 200) {
      return `Seratus ${toWords(n - 100)}`.trim();
    } else if (n < 1000) {
      return `${toWords(Math.floor(n / 100))} Ratus ${toWords(n % 100)}`.trim();
    } else if (n < 2000) {
      return `Seribu ${toWords(n - 1000)}`.trim();
    } else if (n < 1000000) {
      return `${toWords(Math.floor(n / 1000))} Ribu ${toWords(n % 1000)}`.trim();
    } else if (n < 1000000000) {
      return `${toWords(Math.floor(n / 1000000))} Juta ${toWords(n % 1000000)}`.trim();
    } else if (n < 1000000000000) {
      return `${toWords(Math.floor(n / 1000000000))} Miliar ${toWords(n % 1000000000)}`.trim();
    }
    return '';
  }

  const result = toWords(Math.floor(nominal)).trim();
  return result ? `${result} Rupiah` : 'Nol Rupiah';
}

/**
 * Render konten sebagai QR code SVG yang benar-benar bisa dipindai
 * (encoding + error correction via `qrcode`, tanpa jaringan).
 * Async karena encoder membangun matriks modul secara asinkron.
 */
export async function generateSvgQrMatrix(
  content: string,
  size = 180,
  foreground = '#0f172a'
): Promise<string> {
  const svg = await QRCode.toString(content, {
    type: 'svg',
    margin: 0,
    width: size,
    color: { dark: foreground, light: '#ffffff' },
  });

  // Kontainer pemanggil yang menentukan ukuran; SVG cukup mengisi ruang.
  return svg.replace('<svg ', '<svg class="w-full h-full" ');
}

// In-memory Audit Log Store for Security Analyst view
let auditLogList: AuditLog[] = [
  {
    id: 'LOG-001',
    timestamp: '2026-09-08 07:12:05',
    user: 'Super Admin',
    role: 'super_admin',
    action: 'SYSTEM_STARTUP',
    details: 'Inisialisasi modul SIAKAD & LMS Terpadu v1.1',
    ipAddress: '192.168.1.10',
  },
  {
    id: 'LOG-002',
    timestamp: '2026-09-08 07:15:20',
    user: 'Admin TU (Dra. Siti Aminah)',
    role: 'admin_tu',
    action: 'AUTH_LOGIN_SUCCESS',
    details: 'Login via Email & Password terverifikasi',
    ipAddress: '192.168.1.25',
  },
  {
    id: 'LOG-003',
    timestamp: '2026-09-08 07:18:44',
    user: 'Operator (Rizky Ramadhan)',
    role: 'operator',
    action: 'QR_SCANNER_ACTIVATE',
    details: 'Kamera pemindai presensi QR diaktifkan di Gerbang Utama',
    ipAddress: '192.168.1.104',
  },
];

export function getAuditLogs(): AuditLog[] {
  return [...auditLogList];
}

export function addAuditLog(action: string, details: string, user = 'Current User', role = 'active_role'): void {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  const newLog: AuditLog = {
    id: `LOG-${pad(auditLogList.length + 1)}`,
    timestamp,
    user,
    role,
    action,
    details,
    ipAddress: '192.168.1.42',
  };
  auditLogList = [newLog, ...auditLogList.slice(0, 49)];
}
